import { ConflictException, HttpException, HttpStatus, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { DatabaseService } from "./database.service.js";
import { hashPassword, hashSessionToken, verifyPassword } from "./auth-crypto.js";
import { RateLimitService } from "./rate-limit.service.js";
import { loginRateLimitKey, signupRateLimitKey } from "./auth-security.js";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
  ) {}

  async signUp(emailInput: string, password: string, clientAddress = "unknown") {
    const email = emailInput.trim().toLowerCase();
    const mailConfig = getVerificationMailConfig();
    if (!(await this.rateLimit.consume(signupRateLimitKey(clientAddress), 10, 60 * 60, new Date()))) {
      throw new HttpException("Too many signup attempts", HttpStatus.TOO_MANY_REQUESTS);
    }
    const passwordHash = await hashPassword(password);
    const verificationToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(verificationToken).digest("hex");
    const user = await this.database.connection.begin(async (transaction) => {
      const [row] = await transaction<{ id: string; email: string }[]>`
        INSERT INTO users (email, password_hash, email_verified_at)
        VALUES (${email}, ${passwordHash}, NULL)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
        WHERE users.email_verified_at IS NULL
        RETURNING id::text AS id, email
      `;
      if (!row) throw new ConflictException("An account with this email already exists");
      await transaction`DELETE FROM email_verification_tokens WHERE user_id = ${row.id}::uuid`;
      await transaction`
        INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
        VALUES (${row.id}::uuid, ${tokenHash}, now() + interval '24 hours')
      `;
      return row;
    });
    await sendVerificationEmail(mailConfig, user.email, verificationToken);
    return { pending: true as const };
  }

  async verifyEmail(token: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    return this.database.connection.begin(async (transaction) => {
      const [user] = await transaction<{ id: string }[]>`
        UPDATE users SET email_verified_at = now()
        WHERE id = (
          SELECT user_id FROM email_verification_tokens
          WHERE token_hash = ${tokenHash} AND expires_at > now()
          LIMIT 1
        ) AND email_verified_at IS NULL
        RETURNING id::text AS id
      `;
      if (!user) return false;
      await transaction`DELETE FROM email_verification_tokens WHERE user_id = ${user.id}::uuid`;
      return true;
    });
  }

  async signIn(emailInput: string, password: string, clientAddress = "unknown") {
    const email = emailInput.trim().toLowerCase();
    const addressKey = loginRateLimitKey(clientAddress);
    const now = new Date();
    if (!(await this.rateLimit.consume(addressKey, 100, 15 * 60, now))) {
      throw new HttpException("Too many login attempts", HttpStatus.TOO_MANY_REQUESTS);
    }
    const [user] = await this.database.connection<UserRow[]>`
      SELECT id::text AS id, email, password_hash, email_verified_at
      FROM users WHERE email = ${email} LIMIT 1
    `;
    if (!user || !user.email_verified_at || !(await verifyPassword(password, user.password_hash))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    return {
      user: { id: user.id, email: user.email },
      token: await this.createSession(user.id),
    };
  }

  async getSession(token: string | undefined) {
    if (!token) {
      return null;
    }
    const [row] = await this.database.connection<{ id: string; email: string }[]>`
      SELECT u.id::text AS id, u.email
      FROM auth_sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ${hashSessionToken(token)} AND s.expires_at > now()
      LIMIT 1
    `;
    return row ?? null;
  }

  async signOut(token: string | undefined) {
    if (token) {
      await this.database.connection`
        DELETE FROM auth_sessions WHERE token_hash = ${hashSessionToken(token)}
      `;
    }
  }

  private async createSession(userId: string) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
    await this.database.connection`
      INSERT INTO auth_sessions (user_id, token_hash, expires_at)
      VALUES (${userId}::uuid, ${hashSessionToken(token)}, ${expiresAt})
    `;
    return token;
  }

}

interface VerificationMailConfig {
  apiKey: string;
  from: string;
  appBaseUrl: string;
}

function getVerificationMailConfig(): VerificationMailConfig {
  const { RESEND_API_KEY: apiKey, EMAIL_FROM: from, APP_BASE_URL: appBaseUrl } = process.env;
  if (!apiKey || !from || !appBaseUrl) throw new ServiceUnavailableException("Email verification is not configured");
  try {
    const url = new URL(appBaseUrl);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new ServiceUnavailableException("Email verification is not configured");
  }
  return { apiKey, from, appBaseUrl: appBaseUrl.replace(/\/$/, "") };
}

async function sendVerificationEmail(config: VerificationMailConfig, email: string, token: string) {
  const verificationUrl = new URL("/verify-email", config.appBaseUrl);
  verificationUrl.searchParams.set("token", token);
  const response = await fetch("https://api.resend.com/emails", {
    signal: AbortSignal.timeout(10_000),
    method: "POST",
    headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: config.from,
      to: [email],
      subject: "Verify your Cafe'nMe email",
      html: `<p>Verify your Cafe'nMe account by opening <a href="${verificationUrl.toString()}">this link</a>.</p><p>This link expires in 24 hours.</p>`,
      text: `Verify your Cafe'nMe account: ${verificationUrl.toString()} (expires in 24 hours)`,
    }),
  });
  if (!response.ok) throw new ServiceUnavailableException("Could not send verification email");
}
