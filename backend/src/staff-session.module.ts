import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { StaffSessionController } from "./staff-session.controller.js";
import { StaffSessionService } from "./staff-session.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [StaffSessionController],
  providers: [StaffSessionService],
})
export class StaffSessionModule {}
