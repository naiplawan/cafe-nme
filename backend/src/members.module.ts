import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { MembersController } from "./members.controller.js";
import { MembersService } from "./members.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
