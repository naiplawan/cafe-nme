import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import postgres from 'postgres';
import { PasswordRecoveryService } from '../src/password-recovery.service.js';
import { hashPassword, hashSessionToken, verifyPassword } from '../src/auth-crypto.js';
import type { DatabaseService } from '../src/database.service.js';
import type { RateLimitService } from '../src/rate-limit.service.js';
import type { RecoveryMailer } from '../src/recovery-mailer.js';

describe('password recovery', { skip: !process.env.TEST_DATABASE_URL }, () => {
  const sql = postgres(process.env.TEST_DATABASE_URL ?? '', { max: 5 });
  const userId = randomUUID();
  const email = `${userId}@example.com`;
  const sent: { email: string; token: string }[] = [];
  const limits: string[] = [];
  let allow = true;
  const service = new PasswordRecoveryService({ connection: sql } as DatabaseService,
    { consume: async (key: string) => { limits.push(key); return allow; } } as unknown as RateLimitService,
    { assertConfigured() {}, send: async (to: string, token: string) => { sent.push({ email: to, token }); } } as unknown as RecoveryMailer);
  before(async () => { await sql`insert into users (id, email, password_hash) values (${userId}, ${email}, ${await hashPassword('old-password')})`; });
  after(async () => { await sql`delete from users where id = ${userId}`; await sql.end(); });
  it('returns the same response for known and unknown accounts, stores only hashes', async () => {
    const known = await service.request(email.toUpperCase(), '127.0.0.1');
    const unknown = await service.request('unknown@example.com', '127.0.0.1');
    assert.deepEqual(known, unknown);
    assert.equal(sent.length, 1);
    const [row] = await sql`select token_hash from password_reset_tokens where user_id = ${userId}`;
    assert.equal(row.token_hash, hashSessionToken(sent[0].token));
    assert.notEqual(row.token_hash, sent[0].token);
    assert.ok(limits.some((key) => key.startsWith('password-reset-ip:')));
    assert.ok(limits.some((key) => key.startsWith('password-reset-email:')));
  });
  it('consumes a token once under concurrent submissions and revokes sessions', async () => {
    const token = sent.at(-1)!.token;
    await sql`insert into auth_sessions (user_id, token_hash, expires_at) values (${userId}, ${randomUUID()}, now() + interval '1 day')`;
    const outcomes = await Promise.allSettled([service.confirm(token, 'new-password', '127.0.0.1'), service.confirm(token, 'new-password', '127.0.0.1')]);
    assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
    const [user] = await sql`select password_hash from users where id = ${userId}`;
    assert.equal(await verifyPassword('new-password', user.password_hash), true);
    assert.equal((await sql`select id from auth_sessions where user_id = ${userId}`).length, 0);
    await assert.rejects(service.confirm(token, 'other-password', '127.0.0.1'), BadRequestException);
  });
  it('invalidates older links and rejects expired or tampered links', async () => {
    await service.request(email, '127.0.0.1'); const older = sent.at(-1)!.token;
    await service.request(email, '127.0.0.1'); const current = sent.at(-1)!.token;
    await assert.rejects(service.confirm(older, 'new-password', '127.0.0.1'), BadRequestException);
    await assert.rejects(service.confirm('x'.repeat(43), 'new-password', '127.0.0.1'), BadRequestException);
    await sql`update password_reset_tokens set expires_at = now() - interval '1 second' where user_id = ${userId}`;
    await assert.rejects(service.confirm(current, 'new-password', '127.0.0.1'), BadRequestException);
  });
  it('does not send a message when throttled', async () => {
    allow = false; const count = sent.length;
    await service.request(email, '127.0.0.1');
    assert.equal(sent.length, count);
  });
});
