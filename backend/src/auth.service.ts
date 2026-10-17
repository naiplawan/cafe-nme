import { ConflictException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { DatabaseService } from "./database.service.js";
import { hashPassword, hashSessionToken, verifyPassword } from "./auth-crypto.js";
import { RateLimitService } from "./rate-limit.service.js";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
  ) {}

  async signUp(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    if (!(await this.rateLimit.consume(`signup:${email}`, 5, 60 * 60, new Date()))) {
      throw new HttpException("Too many signup attempts", HttpStatus.TOO_MANY_REQUESTS);
    }
    const passwordHash = await hashPassword(password);
    let user: { id: string; email: string };
    try {
      const [row] = await this.database.connection<{ id: string; email: string }[]>`
        INSERT INTO users (email, password_hash)
        VALUES (${email}, ${passwordHash})
        RETURNING id::text AS id, email
      `;
      user = row;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        throw new ConflictException("An account with this email already exists", { cause: error });
      }
      throw error;
    }
    const token = await this.createSession(user.id);
    return { user, token };
  }

  async signIn(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    if (!(await this.rateLimit.consume(`login:${email}`, 10, 15 * 60, new Date()))) {
      throw new HttpException("Too many login attempts", HttpStatus.TOO_MANY_REQUESTS);
    }
    const [user] = await this.database.connection<UserRow[]>`
      SELECT id::text AS id, email, password_hash
      FROM users WHERE email = ${email} LIMIT 1
    `;
    if (!user || !(await verifyPassword(password, user.password_hash))) {
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
