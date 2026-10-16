import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { ModifiersController } from "./modifiers.controller.js";
import { ModifiersService } from "./modifiers.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [ModifiersController],
  providers: [ModifiersService],
})
export class ModifiersModule {}
