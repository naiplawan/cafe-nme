import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { AdminDataController } from "./admin-data.controller.js";
import { AdminDataService } from "./admin-data.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [AdminDataController],
  providers: [AdminDataService],
})
export class AdminDataModule {}
