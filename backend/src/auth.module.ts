import { PasswordRecoveryService } from './password-recovery.service.js';
import { RecoveryMailer } from './recovery-mailer.js';
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RateLimitModule } from './rate-limit.module.js';

@Module({
  imports: [DatabaseModule, RateLimitModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordRecoveryService, RecoveryMailer],
})
export class AuthModule {}
