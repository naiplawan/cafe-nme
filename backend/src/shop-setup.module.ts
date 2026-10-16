import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { ShopSetupController } from "./shop-setup.controller.js";
import { ShopSetupService } from "./shop-setup.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [ShopSetupController],
  providers: [ShopSetupService],
})
export class ShopSetupModule {}
