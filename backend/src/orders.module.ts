import { RefundsController } from "./refunds.controller.js";
import { OmisePaymentsController, OmiseWebhookController } from "./omise-payments.controller.js";
import { OmisePaymentsService } from "./omise-payments.service.js";
import { RefundsService } from "./refunds.service.js";
import { PreparationController } from "./preparation.controller.js";
import { PreparationService } from "./preparation.service.js";
import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { OrdersController } from "./orders.controller.js";
import { OrderQueriesService } from "./order-queries.service.js";
import { OrdersService } from "./orders.service.js";
import { ReconciliationController } from "./reconciliation.controller.js";
import { ReconciliationService } from "./reconciliation.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [OmisePaymentsController, OmiseWebhookController, RefundsController, PreparationController, OrdersController, ReconciliationController],
  providers: [OmisePaymentsService, RefundsService, PreparationService, OrdersService, OrderQueriesService, ReconciliationService],
})
export class OrdersModule {}
