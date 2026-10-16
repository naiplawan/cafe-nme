import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { PosAccessController } from "./pos-access.controller.js";
import { PosAccessService } from "./pos-access.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [PosAccessController],
  providers: [PosAccessService],
})
export class PosAccessModule {}
