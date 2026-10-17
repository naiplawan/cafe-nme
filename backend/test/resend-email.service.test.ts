import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import { ResendEmailService } from '../src/resend-email.service.js';

function createEmailService(request: typeof fetch = fetch) {
  const environment: Record<string, string> = {
    RESEND_API_KEY: 're_test_key',
    EMAIL_FROM_EMAIL: "Cafe'nMe <no-reply@example.com>",
    APP_URL: 'https://cafenme.example',
  };
  return new ResendEmailService(
    { get: (key: string) => environment[key] } as ConfigService,
    request,
  );
}

test('sends formal email templates through the Resend HTTPS API', async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const service = createEmailService(async (input, init) => {
    requests.push({ url: String(input), init: init ?? {} });
    return new Response('{"id":"email-id"}', { status: 200 });
  });

  await service.sendVerification('guest@example.com', 'https://cafenme.example/verify-email?token=test');
  await service.sendWelcomeEmail('guest@example.com');
  await service.sendPasswordReset('guest@example.com', 'https://cafenme.example/reset-password?token=test');
  await service.sendPasswordChanged('guest@example.com');

  assert.equal(requests.length, 4);
  assert.ok(requests.every(({ url }) => url === 'https://api.resend.com/emails'));
  assert.ok(requests.every(({ init }) => init.method === 'POST'));
  assert.ok(requests.every(({ init }) => (init.headers as Record<string, string>).Authorization === 'Bearer re_test_key'));

  const messages = requests.map(({ init }) => JSON.parse(String(init.body)) as Record<string, unknown>);
  assert.ok(messages.every((message) => message.from === "Cafe'nMe <no-reply@example.com>"));
  assert.ok(messages.every((message) => Array.isArray(message.to) && message.to[0] === 'guest@example.com'));
  assert.ok(messages.every((message) => typeof message.text === 'string' && typeof message.html === 'string'));
  assert.ok(messages.every((message) => message.html?.toString().includes('https://cafenme.example/email/cafenme-icon-matcha.png')));
  assert.ok(messages[0].text.toString().includes('24'));
  assert.ok(messages[1].subject?.toString().includes('สำเร็จ'));
  assert.ok(messages[2].text?.toString().includes('30 นาที'));
  assert.ok(messages[3].html?.toString().includes('forgot-password'));
});

test('reports Resend API failures without exposing response details', async () => {
  const service = createEmailService(async () => new Response('sensitive provider response', { status: 401 }));

  await assert.rejects(
    service.sendWelcomeEmail('guest@example.com'),
    (error: unknown) => error instanceof Error && error.message === 'Email API request failed with status 401',
  );
});

test('is configured only when the API key, sender, and app URL are present', () => {
  assert.equal(createEmailService().isConfigured(), true);
  const service = new ResendEmailService(
    { get: (key: string) => key === 'RESEND_API_KEY' ? 're_test_key' : undefined } as ConfigService,
    fetch,
  );
  assert.equal(service.isConfigured(), false);
});
