import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { LiffController } from "./liff.controller.js";
import { LiffService } from "./liff.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [LiffController],
  providers: [LiffService],
})
export class LiffModule {}
