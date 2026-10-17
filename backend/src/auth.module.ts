import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RateLimitModule } from './rate-limit.module.js';
import { EMAIL_HTTP_CLIENT, ResendEmailService } from './resend-email.service.js';

@Module({
  imports: [DatabaseModule, RateLimitModule],
  controllers: [AuthController],
  providers: [AuthService, ResendEmailService, { provide: EMAIL_HTTP_CLIENT, useValue: fetch }],
})
export class AuthModule {}
