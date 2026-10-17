import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EmailTemplate, passwordChangedEmail, passwordResetEmail, verificationEmail, welcomeEmail } from './email-templates.js';

export const EMAIL_HTTP_CLIENT = Symbol('EMAIL_HTTP_CLIENT');

@Injectable()
export class ResendEmailService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(EMAIL_HTTP_CLIENT) private readonly request: typeof fetch = fetch,
  ) {}

  isConfigured() {
    return ['RESEND_API_KEY', 'EMAIL_FROM_EMAIL', 'APP_URL']
      .every((key) => Boolean(this.config.get<string>(key)?.trim()));
  }

  async sendVerification(email: string, verificationUrl: string) {
    await this.sendTemplate(email, verificationEmail(verificationUrl, this.brandLogoUrl()));
  }

  async sendPasswordReset(email: string, resetUrl: string) {
    await this.sendTemplate(email, passwordResetEmail(resetUrl, this.brandLogoUrl()));
  }

  async sendPasswordChanged(email: string) {
    const resetUrl = new URL('/forgot-password', this.requiredSetting('APP_URL')).toString();
    await this.sendTemplate(email, passwordChangedEmail(resetUrl, this.brandLogoUrl()));
  }

  async sendWelcomeEmail(email: string) {
    const loginUrl = new URL('/login', this.requiredSetting('APP_URL')).toString();
    await this.sendTemplate(email, welcomeEmail(loginUrl, this.brandLogoUrl()));
  }

  private brandLogoUrl() {
    return new URL('/email/cafenme-icon-matcha.png', this.requiredSetting('APP_URL')).toString();
  }

  private async sendTemplate(email: string, template: EmailTemplate) {
    const response = await this.request('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.requiredSetting('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.requiredSetting('EMAIL_FROM_EMAIL'),
        to: [email],
        ...template,
      }),
    });
    if (!response.ok) {
      throw new Error(`Email API request failed with status ${response.status}`);
    }
  }

  private requiredSetting(key: string) {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`${key} is not configured`);
    }
    return value;
  }
}
