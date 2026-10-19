import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LoginPage from './login/page';
import SignupPage from './signup/page';

describe('authentication pages', () => {
  it('adds an explanatory desktop panel to login without removing the form', () => {
    const markup = renderToStaticMarkup(createElement(LoginPage));
    expect(markup).toContain('data-auth-showcase');
    expect(markup).toContain('เข้าสู่ระบบ');
    expect(markup).toContain('placeholder="name@example.com"');
  });

  it('adds the same desktop panel to signup and keeps the mobile card', () => {
    const markup = renderToStaticMarkup(createElement(SignupPage));
    expect(markup).toContain('data-auth-showcase');
    expect(markup).toContain('สร้างบัญชี');
    expect(markup).toContain('placeholder="กรอกรหัสผ่าน"');
    expect(markup).toContain('อย่างน้อย 8 ตัวอักษร');
  });
});
