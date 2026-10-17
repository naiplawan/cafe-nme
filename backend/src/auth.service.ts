import { ConflictException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { DatabaseService } from "./database.service.js";
import { hashPassword, hashSessionToken, verifyPassword } from "./auth-crypto.js";
import { RateLimitService } from "./rate-limit.service.js";
import { ResendEmailService } from "./resend-email.service.js";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_LIFETIME_MS = 30 * 60 * 1000;
const EMAIL_VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ResendEmailService) private readonly email: ResendEmailService,
  ) {}

  async signUp(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    if (!(await this.rateLimit.consume(`signup:${email}`, 5, 60 * 60, new Date()))) {
      throw new HttpException("Too many signup attempts", HttpStatus.TOO_MANY_REQUESTS);
    }
    const emailConfigured = this.email.isConfigured();
    const localDevelopment = this.config.get<string>("NODE_ENV") === "development";
    if (!emailConfigured && !localDevelopment) {
      throw new ServiceUnavailableException("Email verification is not configured");
    }
    const passwordHash = await hashPassword(password);
    let user: { id: string; email: string };
    try {
      const [row] = await this.database.connection<{ id: string; email: string }[]>`
        INSERT INTO users (email, password_hash, email_verified_at)
        VALUES (${email}, ${passwordHash}, ${emailConfigured ? null : new Date()})
        RETURNING id::text AS id, email
      `;
      user = row;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        throw new ConflictException("An account with this email already exists", { cause: error });
      }
      throw error;
    }
    if (emailConfigured) {
      await this.issueVerificationEmail(user);
      return { status: "verification_required" };
    }
    const token = await this.createSession(user.id);
    return { user, token };
  }

  async signIn(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    if (!(await this.rateLimit.consume(`login:${email}`, 10, 15 * 60, new Date()))) {
      throw new HttpException("Too many login attempts", HttpStatus.TOO_MANY_REQUESTS);
    }
    const [user] = await this.database.connection<(UserRow & { email_verified_at: Date | null })[]>`
      SELECT id::text AS id, email, password_hash, email_verified_at
      FROM users WHERE email = ${email} LIMIT 1
    `;
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    if (!user.email_verified_at) {
      throw new ForbiddenException("Email address has not been verified");
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
      WHERE s.token_hash = ${hashSessionToken(token)} AND s.expires_at > now() AND u.email_verified_at IS NOT NULL
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

  async resendEmailVerification(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    if (!(await this.rateLimit.consume(`email-verification:${email}`, 3, 60 * 60, new Date()))) {
      throw new HttpException("Too many email verification requests", HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!this.email.isConfigured()) {
      if (this.config.get<string>("NODE_ENV") === "development") {
        return { status: "accepted" };
      }
      throw new ServiceUnavailableException("Email verification is not configured");
    }
    const [user] = await this.database.connection<{ id: string; email: string; email_verified_at: Date | null }[]>`
      SELECT id::text AS id, email, email_verified_at FROM users WHERE email = ${email} LIMIT 1
    `;
    if (user && !user.email_verified_at) {
      await this.issueVerificationEmail(user);
    }
    return { status: "accepted" };
  }

  async confirmEmailVerification(token: string) {
    const tokenHash = hashSessionToken(token);
    const verifiedEmail = await this.database.connection.begin(async (transaction) => {
      const [verification] = await transaction<{ user_id: string }[]>`
        DELETE FROM email_verification_tokens
        WHERE token_hash = ${tokenHash} AND expires_at > now()
        RETURNING user_id::text AS user_id
      `;
      if (!verification) {
        return null;
      }
      const [user] = await transaction<{ email: string }[]>`
        UPDATE users SET email_verified_at = COALESCE(email_verified_at, now())
        WHERE id = ${verification.user_id}::uuid
        RETURNING email
      `;
      if (!user) {
        return null;
      }
      await transaction`DELETE FROM email_verification_tokens WHERE user_id = ${verification.user_id}::uuid`;
      return user.email;
    });
    if (!verifiedEmail) {
      throw new UnauthorizedException("Invalid or expired email verification link");
    }
    try {
      await this.email.sendWelcomeEmail(verifiedEmail);
    } catch (error) {
      this.logger.error("Registration welcome email could not be sent", error instanceof Error ? error.stack : undefined);
    }
    return { status: "email_verified" };
  }

  async requestPasswordReset(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    if (!(await this.rateLimit.consume(`password-reset:${email}`, 3, 60 * 60, new Date()))) {
      throw new HttpException("Too many password reset requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!this.email.isConfigured()) {
      throw new ServiceUnavailableException("Password reset email is not configured");
    }
    const appUrl = this.config.getOrThrow<string>("APP_URL");

    const [user] = await this.database.connection<{ id: string }[]>`
      SELECT id::text AS id FROM users WHERE email = ${email} LIMIT 1
    `;
    if (!user) {
      return { status: "accepted" };
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_LIFETIME_MS);
    await this.database.connection`DELETE FROM password_reset_tokens WHERE expires_at <= now()`;
    await this.database.connection`
      DELETE FROM password_reset_tokens WHERE user_id = ${user.id}::uuid
    `;
    await this.database.connection`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}::uuid, ${tokenHash}, ${expiresAt})
    `;

    const resetUrl = new URL(`/reset-password?token=${encodeURIComponent(token)}`, appUrl).toString();
    try {
      await this.email.sendPasswordReset(email, resetUrl);
    } catch (error) {
      await this.database.connection`DELETE FROM password_reset_tokens WHERE token_hash = ${tokenHash}`;
      throw new ServiceUnavailableException("Password reset email could not be sent", { cause: error });
    }
    return { status: "accepted" };
  }

  async resetPassword(token: string, password: string) {
    const passwordHash = await hashPassword(password);
    const tokenHash = hashSessionToken(token);
    const changedEmail = await this.database.connection.begin(async (transaction) => {
      const [row] = await transaction<{ user_id: string; email: string }[]>`
        WITH consumed AS (
          DELETE FROM password_reset_tokens
          WHERE token_hash = ${tokenHash} AND expires_at > now()
          RETURNING user_id
        )
        UPDATE users
        SET password_hash = ${passwordHash}, email_verified_at = COALESCE(users.email_verified_at, now())
        FROM consumed
        WHERE users.id = consumed.user_id
        RETURNING users.id::text AS user_id, users.email
      `;
      if (row) {
        await transaction`DELETE FROM auth_sessions WHERE user_id = ${row.user_id}::uuid`;
      }
      return row?.email;
    });
    if (!changedEmail) {
      throw new UnauthorizedException("Invalid or expired password reset link");
    }
    try {
      await this.email.sendPasswordChanged(changedEmail);
    } catch (error) {
      this.logger.error("Password changed email could not be sent", error instanceof Error ? error.stack : undefined);
    }
    return { status: "password_updated" };
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

  private async issueVerificationEmail(user: { id: string; email: string }) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_LIFETIME_MS);
    await this.database.connection`DELETE FROM email_verification_tokens WHERE expires_at <= now()`;
    await this.database.connection`DELETE FROM email_verification_tokens WHERE user_id = ${user.id}::uuid`;
    await this.database.connection`
      INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}::uuid, ${tokenHash}, ${expiresAt})
    `;
    const verificationUrl = new URL(`/verify-email?token=${encodeURIComponent(token)}`, this.config.getOrThrow<string>("APP_URL")).toString();
    try {
      await this.email.sendVerification(user.email, verificationUrl);
    } catch (error) {
      await this.database.connection`DELETE FROM email_verification_tokens WHERE token_hash = ${tokenHash}`;
      throw new ServiceUnavailableException("Verification email could not be sent", { cause: error });
    }
  }

}
