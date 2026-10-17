import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { PaymentSettingsController } from "./payment-settings.controller.js";
import { PaymentSettingsService } from "./payment-settings.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [PaymentSettingsController],
  providers: [PaymentSettingsService],
})
export class PaymentSettingsModule {}
