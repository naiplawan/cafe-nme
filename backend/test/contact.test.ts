import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { after, before, describe, it, mock } from 'node:test';
import { BadRequestException, Module, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import postgres from 'postgres';
import { ContactMessageDto } from '../src/contact.controller.js';
import { validateEnvironment } from '../src/config/validate-env.js';

const valid = { name: ' Visitor ', email: ' HELLO@EXAMPLE.COM ', topic: 'demo', message: ' Tell me about your POS. ', consent: true };

describe('contact environment', () => {
  const env = { DATABASE_URL: 'postgres://localhost/test', INTERNAL_API_SECRET: 'x'.repeat(32) };
  it('allows an unset inbox and rejects an invalid configured inbox', () => {
    assert.equal(validateEnvironment(env).CONTACT_INBOX_EMAIL, undefined);
    assert.equal(validateEnvironment({ ...env, CONTACT_INBOX_EMAIL: '' }).CONTACT_INBOX_EMAIL, undefined);
    assert.throws(() => validateEnvironment({ ...env, CONTACT_INBOX_EMAIL: 'invalid' }), /CONTACT_INBOX_EMAIL/);
    assert.equal(validateEnvironment({ ...env, CONTACT_INBOX_EMAIL: 'team@example.com' }).CONTACT_INBOX_EMAIL, 'team@example.com');
  });
});

describe('contact validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const validate = (body: unknown) => pipe.transform(body, { type: 'body', metatype: ContactMessageDto });
  it('normalizes visitor input before validation', async () => {
    const result = await validate(valid);
    assert.equal(result.name, 'Visitor');
    assert.equal(result.email, 'hello@example.com');
    assert.equal(result.message, 'Tell me about your POS.');
  });
  it('requires real consent and rejects invalid or unknown fields', async () => {
    for (const extra of [{ consent: false }, { consent: 'true' }, { message: 'short' },
      { email: 'invalid' }, { topic: 'sales' }, { unknown: true }, { name: 42 },
      { name: '   ' }, { phone: '123' }, { message: 'x'.repeat(2001) }]) {
      await assert.rejects(validate({ ...valid, ...extra }), BadRequestException);
    }
  });
});

describe('contact HTTP and persistence', { skip: !process.env.TEST_DATABASE_URL }, () => {
  const sql = postgres(process.env.TEST_DATABASE_URL ?? '', { max: 5 });
  const secret = 'contact-test-secret-'.repeat(3);
  const token = createHmac('sha256', secret).update('cafe-pos:internal-api-v1').digest('hex');
  const prefix = randomUUID();
  const notifications: Record<string, unknown>[] = [];
  let mailFails = false;
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let base: string;
  before(async () => {
    // Compiled controllers preserve decorator metadata required by ValidationPipe.
    const { ContactController } = await import('../dist/contact.controller.js');
    const { ContactService } = await import('../dist/contact.service.js');
    const { DatabaseService } = await import('../dist/database.service.js');
    const { RateLimitService } = await import('../dist/rate-limit.service.js');
    const { HttpExceptionFilter } = await import('../dist/http-exception.filter.js');
    process.env.CONTACT_INBOX_EMAIL = 'inbox@example.com';
    process.env.RESEND_API_KEY = 'test-only';
    process.env.RECOVERY_EMAIL_FROM = 'contact@example.com';
    delete process.env.OPERATIONAL_ALERT_WEBHOOK_URL;
    mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
      if (url !== 'https://api.resend.com/emails') { throw new Error('Unexpected external request'); }
      notifications.push(JSON.parse(String(options.body)));
      if (mailFails) { throw new Error('provider down'); }
      return new Response('{}', { status: 200 });
    });
    @Module({
      controllers: [ContactController],
      providers: [ContactService, RateLimitService,
        { provide: DatabaseService, useValue: { connection: sql } },
        { provide: ConfigService, useValue: new ConfigService({ INTERNAL_API_SECRET: secret }) }],
    })
    class TestModule {}
    app = await NestFactory.create(TestModule, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  after(async () => {
    await app?.close();
    await sql`delete from contact_messages where message like ${`${prefix}%`}`;
    await sql.end();
    mock.restoreAll();
  });
  // Use node:http so the Resend fetch stub can never swallow API requests.
  async function submit(body: Record<string, unknown>, address = randomUUID(), auth: string | null = token) {
    const { request } = await import('node:http');
    return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
      const req = request(`${base}/v1/contact-messages`, { method: 'POST', headers: {
        'content-type': 'application/json', 'x-client-address': address,
        ...(auth === null ? {} : { 'x-internal-api-token': auth }),
      } }, (res) => {
        let text = '';
        res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(text) }));
      });
      req.on('error', reject);
      req.end(JSON.stringify(body));
    });
  }
  const input = (extra = {}) => ({ ...valid, email: ` ${prefix.toUpperCase()}@EXAMPLE.COM `, message: `${prefix} contact message`, ...extra });
  it('stores normalized fields and a hashed IP, sends plain-text notification with reply_to', async () => {
    const response = await submit(input({ phone: ' +66 12345678 ', shopName: ' Coffee shop ' }), `${prefix}-address`);
    assert.equal(response.status, 201);
    assert.deepEqual(response.body, { status: 'received' });
    const rows = await sql`select * from contact_messages where message = ${`${prefix} contact message`}`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Visitor');
    assert.equal(rows[0].email, `${prefix}@example.com`);
    assert.equal(rows[0].shop_name, 'Coffee shop');
    assert.equal(rows[0].phone, '+66 12345678');
    assert.equal(rows[0].client_address_hash, createHash('sha256').update(`${prefix}-address`).digest('hex'));
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].reply_to, `${prefix}@example.com`);
    assert.deepEqual(notifications[0].to, ['inbox@example.com']);
    assert.ok(String(notifications[0].text).includes(`${prefix} contact message`));
  });
  it('retains the message and returns 201 when email delivery fails or is unconfigured', async () => {
    mailFails = true;
    assert.equal((await submit(input({ email: `${prefix}-fail@example.com` }))).status, 201);
    delete process.env.CONTACT_INBOX_EMAIL;
    assert.equal((await submit(input({ email: `${prefix}-unset@example.com` }))).status, 201);
    assert.equal((await sql`select id from contact_messages where message = ${`${prefix} contact message`}`).length, 3);
    process.env.CONTACT_INBOX_EMAIL = 'inbox@example.com';
    mailFails = false;
  });
  it('rejects invalid fields and unknown properties without storing a message', async () => {
    const beforeCount = (await sql`select id from contact_messages`).length;
    for (const extra of [{ consent: false }, { consent: 'true' }, { message: 'short' }, { email: 'bad' },
      { unexpected: true }, { topic: 'sales' }, { name: '   ' }, { phone: 'abc123456' },
      { shopName: 'x'.repeat(121) }, { name: 'x'.repeat(101) }, { message: 'x'.repeat(2001) }]) {
      assert.equal((await submit(input(extra))).status, 400, JSON.stringify(extra));
    }
    assert.equal((await sql`select id from contact_messages`).length, beforeCount);
  });
  it('requires a valid internal token', async () => {
    assert.equal((await submit(input(), 'unknown', null)).status, 401);
    assert.equal((await submit(input(), 'unknown', 'wrong')).status, 401);
  });
  it('limits IPs to five per hour and emails to three per day', async () => {
    const address = `${prefix}-ip`;
    for (let i = 0; i < 5; i += 1) { assert.equal((await submit(input({ email: `${prefix}-${i}@example.com` }), address)).status, 201); }
    const ipLimit = await submit(input({ email: `${prefix}-next@example.com` }), address);
    assert.equal(ipLimit.status, 429);
    assert.equal(ipLimit.body.code, 'contact_rate_limited');
    const email = `${prefix}-limited@example.com`;
    for (let i = 0; i < 3; i += 1) { assert.equal((await submit(input({ email }))).status, 201); }
    const emailLimit = await submit(input({ email: email.toUpperCase() }));
    assert.equal(emailLimit.status, 429);
    assert.equal(emailLimit.body.code, 'contact_rate_limited');
  });
  it('allows requests again after both rate-limit windows expire', async () => {
    const address = `${prefix}-window`;
    const email = `${prefix}-window@example.com`;
    for (let i = 0; i < 3; i += 1) { assert.equal((await submit(input({ email }), address)).status, 201); }
    assert.equal((await submit(input({ email }), address)).status, 429);
    const emailHash = createHash('sha256').update(email).digest('hex');
    const keys = [`contact-ip:${address}`, `contact-email:${emailHash}`].map((key) => createHash('sha256').update(key).digest('hex'));
    await sql`update rate_limit_attempts set window_started_at = now() - interval '2 days' where key in ${sql(keys)}`;
    assert.equal((await submit(input({ email }), address)).status, 201);
  });
  it('enables RLS on stored contact data', async () => {
    const [row] = await sql`select relrowsecurity from pg_class where oid = 'public.contact_messages'::regclass`;
    assert.equal(row.relrowsecurity, true);
  });
  it('returns a sanitized 500 if storage fails, without sending a notification', async () => {
    const count = notifications.length;
    await sql`alter table contact_messages rename to contact_messages_test_unavailable`;
    try {
      const response = await submit(input({ email: 'database-error@example.com' }));
      assert.equal(response.status, 500);
      assert.equal(response.body.message, 'Internal server error');
      assert.equal(notifications.length, count);
    } finally {
      await sql`alter table contact_messages_test_unavailable rename to contact_messages`;
    }
  });

});
