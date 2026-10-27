import { createHash } from 'node:crypto';
import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import type { ContactMessageDto } from './contact.controller.js';
import { DatabaseService } from './database.service.js';
import { RateLimitService } from './rate-limit.service.js';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RateLimitService) private readonly limits: RateLimitService,
  ) {}

  async receive(input: ContactMessageDto, clientAddress: string) {
    const email = input.email.trim().toLowerCase();
    const now = new Date();
    if (!(await this.limits.consume(`contact-ip:${clientAddress}`, 5, 3600, now)) ||
        !(await this.limits.consume(`contact-email:${createHash('sha256').update(email).digest('hex')}`, 3, 86_400, now))) {
      throw new HttpException({ message: 'Too many contact messages', code: 'contact_rate_limited' }, 429);
    }
    const addressHash = createHash('sha256').update(clientAddress).digest('hex');
    await this.database.connection`
      insert into contact_messages (name, email, phone, shop_name, topic, message, client_address_hash)
      values (${input.name}, ${email}, ${input.phone ?? null}, ${input.shopName ?? null},
        ${input.topic}, ${input.message}, ${addressHash})
    `;
    void this.notify(input, email).catch(() => this.logger.error('Contact email delivery failed'));
    return { status: 'received' as const };
  }

  private async notify(input: ContactMessageDto, email: string) {
    const inbox = process.env.CONTACT_INBOX_EMAIL;
    if (!inbox || !process.env.RESEND_API_KEY || !process.env.RECOVERY_EMAIL_FROM) {
      this.logger.log('contact email not configured');
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RECOVERY_EMAIL_FROM, to: [inbox], reply_to: email,
        subject: `ติดต่อจากเว็บ YELO Coffee: ${input.topic}`,
        text: `Name: ${input.name}\nEmail: ${email}\nPhone: ${input.phone ?? ''}\nShop: ${input.shopName ?? ''}\n\n${input.message}`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error('Contact email provider rejected delivery');
    }
  }
}
