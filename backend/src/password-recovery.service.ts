import { randomBytes } from 'node:crypto';
import { BadRequestException, HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { RateLimitService } from './rate-limit.service.js';
import { RecoveryMailer } from './recovery-mailer.js';
import { hashPassword, hashSessionToken } from './auth-crypto.js';

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RateLimitService) private readonly limits: RateLimitService,
    @Inject(RecoveryMailer) private readonly mailer: RecoveryMailer,
  ) {}

  async request(emailInput: string, clientAddress: string) {
    this.mailer.assertConfigured();
    const email = emailInput.trim().toLowerCase();
    const now = new Date();
    const accepted = { status: 'accepted' as const };
    if (!(await this.limits.consume(`password-reset-ip:${clientAddress}`, 10, 3600, now))) return accepted;
    if (!(await this.limits.consume(`password-reset-email:${hashSessionToken(email)}`, 3, 3600, now))) return accepted;
    const token = randomBytes(32).toString('base64url');
    const found = await this.database.connection.begin(async (tx) => {
      // The user row serializes requests and confirmation, including concurrent links.
      const [user] = await tx`select id from users where email = ${email} for update`;
      if (!user) return false;
      await tx`delete from password_reset_tokens where user_id = ${user.id}`;
      await tx`insert into password_reset_tokens (user_id, token_hash, expires_at)
        values (${user.id}, ${hashSessionToken(token)}, now() + interval '30 minutes')`;
      return true;
    });
    // Delivery latency and provider errors must not reveal whether an account exists.
    if (found) void this.mailer.send(email, token).catch(() => this.logger.error('Password recovery email delivery failed'));
    return accepted;
  }

  async confirm(token: string, password: string, clientAddress: string) {
    if (!(await this.limits.consume(`password-reset-confirm:${clientAddress}`, 20, 900, new Date()))) {
      throw new HttpException('Too many reset attempts', 429);
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(token) || password.length < 8 || password.length > 128) {
      throw new BadRequestException('Invalid reset request');
    }
    const tokenHash = hashSessionToken(token);
    const passwordHash = await hashPassword(password);
    await this.database.connection.begin(async (tx) => {
      const [candidate] = await tx`select user_id from password_reset_tokens where token_hash = ${tokenHash} and expires_at > now()`;
      if (!candidate) throw new BadRequestException('Reset link is invalid or expired');
      await tx`select id from users where id = ${candidate.user_id} for update`;
      const used = await tx`delete from password_reset_tokens where token_hash = ${tokenHash} and expires_at > now() returning user_id`;
      if (!used.length) throw new BadRequestException('Reset link is invalid or expired');
      await tx`update users set password_hash = ${passwordHash} where id = ${candidate.user_id}`;
      await tx`delete from auth_sessions where user_id = ${candidate.user_id}`;
      await tx`delete from password_reset_tokens where user_id = ${candidate.user_id}`;
    });
    return { status: 'password_reset' as const };
  }
}
