import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { RateLimitController } from "./rate-limit.controller.js";
import { RateLimitService } from "./rate-limit.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [RateLimitController],
  providers: [RateLimitService],
})
export class RateLimitModule {}
