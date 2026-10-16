import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";
import { BrandModule } from "./brand.module.js";
import { AdminDataModule } from "./admin-data.module.js";
import { DatabaseModule } from "./database.module.js";
import { HealthController } from "./health.controller.js";
import { LiffModule } from "./liff.module.js";
import { LineModule } from "./line.module.js";
import { MenuController } from "./menu.controller.js";
import { MenuService } from "./menu.service.js";
import { MembersModule } from "./members.module.js";
import { ModifiersModule } from "./modifiers.module.js";
import { OrdersModule } from "./orders.module.js";
import { PosAccessModule } from "./pos-access.module.js";
import { RateLimitModule } from "./rate-limit.module.js";
import { ReportsModule } from "./reports.module.js";
import { ShopSetupModule } from "./shop-setup.module.js";
import { StaffSessionModule } from "./staff-session.module.js";
import { validateEnvironment } from "./config/validate-env.js";

@Module({
  controllers: [HealthController, CatalogController, MenuController],
  providers: [CatalogService, MenuService],
  imports: [
    ConfigModule.forRoot({
      envFilePath: ["../frontend/.env.local", ".env"],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    AdminDataModule,
    BrandModule,
    DatabaseModule,
    LiffModule,
    LineModule,
    MembersModule,
    ModifiersModule,
    OrdersModule,
    PosAccessModule,
    RateLimitModule,
    ReportsModule,
    ShopSetupModule,
    StaffSessionModule,
  ],
})
export class AppModule {}
