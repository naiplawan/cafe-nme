import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import { RecoveryMailer } from '../src/recovery-mailer.js';
const originalFetch = globalThis.fetch;
const original = { RESEND_API_KEY: process.env.RESEND_API_KEY, RECOVERY_EMAIL_FROM: process.env.RECOVERY_EMAIL_FROM, FRONTEND_URL: process.env.FRONTEND_URL };
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
test('unconfigured recovery fails visibly instead of claiming mail was sent', () => {
  delete process.env.RESEND_API_KEY;
  assert.throws(() => new RecoveryMailer().assertConfigured(), ServiceUnavailableException);
});
test('sends a fragment reset link and rejects provider failure', async () => {
  process.env.RESEND_API_KEY = 'test-key'; process.env.RECOVERY_EMAIL_FROM = 'Cafe <test@example.com>'; process.env.FRONTEND_URL = 'https://cafe.example.com';
  let payload: Record<string, unknown> = {};
  globalThis.fetch = async (_url, init) => { payload = JSON.parse(String(init?.body)); return new Response('{}', {status: 200}); };
  const mailer = new RecoveryMailer();
  await mailer.send('owner@example.com', 'x'.repeat(43));
  assert.deepEqual(payload.to, ['owner@example.com']);
  assert.match(String(payload.text), /https:\/\/cafe.example.com\/reset-password#token=x{43}/);
  globalThis.fetch = async () => new Response('{}', {status: 503});
  await assert.rejects(mailer.send('owner@example.com', 'x'.repeat(43)));
});
