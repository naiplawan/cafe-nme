import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class RecoveryMailer {
  assertConfigured() {
    const origin = process.env.FRONTEND_URL;
    if (!process.env.RESEND_API_KEY || !process.env.RECOVERY_EMAIL_FROM || !origin) {
      throw new ServiceUnavailableException('Password recovery email is not configured');
    }
    const url = new URL(origin);
    if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      throw new ServiceUnavailableException('Password recovery requires an HTTPS frontend URL');
    }
  }

  async send(email: string, token: string) {
    this.assertConfigured();
    const url = new URL('/reset-password', process.env.FRONTEND_URL!);
    url.hash = new URLSearchParams({ token }).toString();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RECOVERY_EMAIL_FROM,
        to: [email],
        subject: 'ตั้งรหัสผ่านใหม่สำหรับ YELO Coffee',
        text: `เปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (ใช้ได้ครั้งเดียวภายใน 30 นาที):\n${url}\n\nหากคุณไม่ได้ร้องขอ สามารถละเว้นอีเมลนี้ได้`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Recovery email provider returned ${response.status}`);
  }
}
