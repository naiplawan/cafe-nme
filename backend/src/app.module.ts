import { TrialCheckoutController } from "./trial-checkout.controller.js";
import { TrialCheckoutService } from "./trial-checkout.service.js";
import { LoyaltyGroupsController } from "./loyalty-groups.controller.js";
import { LoyaltyGroupsService } from "./loyalty-groups.service.js";
import { SubscriptionsController } from "./subscriptions.controller.js";
import { SubscriptionsService } from "./subscriptions.service.js";
import { InventoryController } from "./inventory.controller.js";
import { InventoryService } from "./inventory.service.js";
import { SelfOrdersController } from "./self-orders.controller.js";
import { SelfOrdersService } from "./self-orders.service.js";
import { ShiftsController } from "./shifts.controller.js";
import { ShiftsService } from "./shifts.service.js";
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { BrandModule } from './brand.module.js';
import { AdminDataModule } from './admin-data.module.js';
import { AuthModule } from './auth.module.js';
import { ContactModule } from './contact.module.js';
import { DatabaseModule } from './database.module.js';
import { HealthController } from './health.controller.js';
import { LiffModule } from './liff.module.js';
import { LineModule } from './line.module.js';
import { MenuController } from './menu.controller.js';
import { MenuService } from './menu.service.js';
import { MenuAvailabilityService } from './menu-availability.service.js';
import { MenuStockService } from './menu-stock.service.js';
import { MembersModule } from './members.module.js';
import { ModifiersModule } from './modifiers.module.js';
import { OrdersModule } from './orders.module.js';
import { PaymentSettingsModule } from './payment-settings.module.js';
import { PosAccessModule } from './pos-access.module.js';
import { RateLimitModule } from './rate-limit.module.js';
import { ReportsModule } from './reports.module.js';
import { ShopSetupModule } from './shop-setup.module.js';
import { StaffSessionModule } from './staff-session.module.js';
import { validateEnvironment } from './config/validate-env.js';

@Module({
  controllers: [TrialCheckoutController, LoyaltyGroupsController, SubscriptionsController, InventoryController, SelfOrdersController, ShiftsController, HealthController, CatalogController, MenuController],
  providers: [TrialCheckoutService, LoyaltyGroupsService, SubscriptionsService, InventoryService, SelfOrdersService, ShiftsService, CatalogService, MenuService, MenuAvailabilityService, MenuStockService],
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['../frontend/.env.local', '.env'],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    AdminDataModule,
    AuthModule,
    BrandModule,
    ContactModule,
    DatabaseModule,
    LiffModule,
    LineModule,
    MembersModule,
    ModifiersModule,
    OrdersModule,
    PaymentSettingsModule,
    PosAccessModule,
    RateLimitModule,
    ReportsModule,
    ShopSetupModule,
    StaffSessionModule,
  ],
})
export class AppModule {}
