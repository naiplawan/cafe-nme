import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { LineController } from "./line.controller.js";
import { LineService } from "./line.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [LineController],
  providers: [LineService],
})
export class LineModule {}
