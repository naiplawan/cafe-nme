import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { BrandController } from "./brand.controller.js";
import { BrandService } from "./brand.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [BrandController],
  providers: [BrandService],
})
export class BrandModule {}
