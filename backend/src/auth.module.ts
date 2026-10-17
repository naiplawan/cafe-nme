import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { RateLimitModule } from "./rate-limit.module.js";

@Module({
  imports: [DatabaseModule, RateLimitModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
