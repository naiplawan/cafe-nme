import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/auth.service.js';
import { hashPassword } from '../src/auth-crypto.js';

function createVerifiedSignupFixture() {
  let account: { id: string; email: string; password_hash: string; email_verified_at: Date | null } | undefined;
  let verificationTokenHash: string | undefined;
  let verificationTokenUsed = false;
  let sessionCreated = false;

  const connection = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(' ');
    if (query.includes('INSERT INTO users')) {
      account = {
        id: 'user-1',
        email: String(values[0]),
        password_hash: String(values[1]),
        email_verified_at: null,
      };
      return [{ id: account.id, email: account.email, email_verified_at: null }];
    }
    if (query.includes('INSERT INTO email_verification_tokens')) {
      verificationTokenHash = String(values[1]);
      return [];
    }
    if (query.includes('INSERT INTO auth_sessions')) {
      sessionCreated = true;
      return [];
    }
    if (query.includes('FROM users WHERE email =')) {
      return account ? [account] : [];
    }
    return [];
  };
  Object.assign(connection, {
    begin: async (operation: typeof connection) => operation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join(' ');
      if (query.includes('DELETE FROM email_verification_tokens') && query.includes('RETURNING user_id')) {
        if (verificationTokenUsed || verificationTokenHash !== values[0]) return [];
        verificationTokenUsed = true;
        return [{ user_id: 'user-1' }];
      }
      if (query.includes('UPDATE users SET email_verified_at')) {
        if (!account) return [];
        account.email_verified_at = new Date();
        return [{ email: account.email }];
      }
      return [];
    }),
  });

  const verificationEmails: { email: string; url: string }[] = [];
  const welcomeEmails: string[] = [];
  const email = {
    isConfigured: () => true,
    sendVerification: async (recipient: string, url: string) => { verificationEmails.push({ email: recipient, url }); },
    sendWelcomeEmail: async (recipient: string) => { welcomeEmails.push(recipient); },
  };
  const service = new AuthService(
    { connection } as never,
    { consume: async () => true } as never,
    {
      get: (key: string) => key === 'APP_URL' ? 'https://cafenme.example' : 'production',
      getOrThrow: () => 'https://cafenme.example',
    } as ConfigService,
    email as never,
  );
  return { service, verificationEmails, welcomeEmails, isSessionCreated: () => sessionCreated };
}

test('signup requires email verification before creating a session and confirms only once', async () => {
  const fixture = createVerifiedSignupFixture();

  assert.deepEqual(await fixture.service.signUp('Guest@Example.com', 'new-password-123'), { status: 'verification_required' });
  assert.equal(fixture.isSessionCreated(), false);
  assert.deepEqual(fixture.verificationEmails.map(({ email }) => email), ['guest@example.com']);

  const token = new URL(fixture.verificationEmails[0].url).searchParams.get('token');
  assert.ok(token);
  assert.deepEqual(await fixture.service.confirmEmailVerification(token), { status: 'email_verified' });
  assert.deepEqual(fixture.welcomeEmails, ['guest@example.com']);
  await assert.rejects(fixture.service.confirmEmailVerification(token), UnauthorizedException);
});

test('login does not reveal verification status until the password is valid', async () => {
  const passwordHash = await hashPassword('correct-password');
  const connection = async () => [{
    id: 'user-1',
    email: 'guest@example.com',
    password_hash: passwordHash,
    email_verified_at: null,
  }];
  const service = new AuthService(
    { connection } as never,
    { consume: async () => true } as never,
    {} as ConfigService,
    { isConfigured: () => true } as never,
  );

  await assert.rejects(service.signIn('guest@example.com', 'wrong-password'), UnauthorizedException);
  await assert.rejects(service.signIn('guest@example.com', 'correct-password'), ForbiddenException);
});

test('resending verification returns an accepted result and sends only for an unverified account', async () => {
  const pendingEmails: string[] = [];
  let verified = false;
  const database = {
    connection: async () => [{ id: 'user-1', email: 'guest@example.com', email_verified_at: verified ? new Date() : null }],
  };
  const service = new AuthService(
    database as never,
    { consume: async () => true } as never,
    {
      get: (key: string) => key === 'APP_URL' ? 'https://cafenme.example' : 'production',
      getOrThrow: () => 'https://cafenme.example',
    } as ConfigService,
    {
      isConfigured: () => true,
      sendVerification: async (email: string) => { pendingEmails.push(email); },
    } as never,
  );

  assert.deepEqual(await service.resendEmailVerification('Guest@Example.com'), { status: 'accepted' });
  verified = true;
  assert.deepEqual(await service.resendEmailVerification('guest@example.com'), { status: 'accepted' });
  assert.deepEqual(pendingEmails, ['guest@example.com']);
});
