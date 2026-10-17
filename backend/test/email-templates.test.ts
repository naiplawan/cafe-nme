import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passwordChangedEmail, passwordResetEmail, verificationEmail, welcomeEmail } from '../src/email-templates.js';

test('renders a formal verification email with escaped links and expiry information', () => {
  const verificationUrl = 'https://cafenme.example/verify-email?token=abc&next=<script>';
  const email = verificationEmail(verificationUrl);

  assert.equal(email.subject, 'ยืนยันที่อยู่อีเมลสำหรับบัญชี Cafe\'nMe');
  assert.match(email.html, /เรียน ท่านผู้สมัคร/);
  assert.match(email.html, /ยืนยันที่อยู่อีเมล/);
  assert.match(email.html, /abc&amp;next=&lt;script&gt;/);
  assert.match(email.text, /24 ชั่วโมง/);
  assert.match(email.text, /ขอแสดงความนับถือ/);
  assert.doesNotMatch(email.html, /next=<script>/);
});

test('provides consistent formal templates for welcome, reset, and password-change emails', () => {
  const templates = [
    welcomeEmail('https://cafenme.example/login'),
    passwordResetEmail('https://cafenme.example/reset-password?token=abc'),
    passwordChangedEmail('https://cafenme.example/forgot-password'),
  ];

  for (const email of templates) {
    assert.match(email.html, /Cafe'nMe/);
    assert.match(email.html, /ขอแสดงความนับถือ/);
    assert.match(email.html, /width="600"/);
    assert.ok(email.text.length > 0);
  }
  assert.match(templates[1].text, /30 นาที/);
});
