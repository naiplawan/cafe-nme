import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';
import { DatabaseModule } from './database.module.js';
import { RateLimitModule } from './rate-limit.module.js';

@Module({
  imports: [DatabaseModule, RateLimitModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
