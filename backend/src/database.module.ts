import { Module } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";
import { InternalApiGuard } from "./internal-api.guard.js";

@Module({
  providers: [DatabaseService, InternalApiGuard],
  exports: [DatabaseService, InternalApiGuard],
})
export class DatabaseModule {}
