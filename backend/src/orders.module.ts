import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { OrdersController } from "./orders.controller.js";
import { OrderQueriesService } from "./order-queries.service.js";
import { OrdersService } from "./orders.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderQueriesService],
})
export class OrdersModule {}
