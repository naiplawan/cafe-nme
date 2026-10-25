import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { InternalApiGuard } from "./internal-api.guard.js";
import { InventoryService } from "./inventory.service.js";

class StockPolicyDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty({ enum: ['payment','preparation'] }) @IsIn(['payment','preparation']) mode!: 'payment' | 'preparation';
}
class StockPolicyResultDto { @ApiProperty({ enum: ['payment','preparation'] }) mode!: string; }
class RemakeDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty() @IsUUID() requestId!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(99) qty!: number;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason!: string;
}
class InventoryValuationDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty() @IsUUID() requestId!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) onHandMilliunits!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(2147483647) costSatang!: number;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason!: string;
}
class IngredientDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @ApiProperty({ enum: ["g", "ml", "unit"] }) @IsIn(["g", "ml", "unit"]) unit!: "g" | "ml" | "unit";
  @ApiProperty() @IsInt() @Min(0) @Max(2147483647) lowStockMilliunits!: number;
}
class ThresholdDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(2147483647) lowStockMilliunits!: number;
}
class RecipeLineDto {
  @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsUUID() replacesIngredientId?: string | null;
  @ApiProperty() @IsUUID() ingredientId!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(2147483647) quantityMilliunits!: number;
}
class RecipeDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty({ type: RecipeLineDto, isArray: true }) @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => RecipeLineDto) lines!: RecipeLineDto[];
}
class InventoryMoveDto {
  @ApiPropertyOptional({ type: Number, nullable: true }) @IsOptional() @IsInt() @Min(0) @Max(2147483647) costSatang?: number | null;
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty() @IsUUID() requestId!: string;
  @ApiProperty({ enum: ["receive", "waste", "adjust"] }) @IsIn(["receive", "waste", "adjust"]) kind!: "receive" | "waste" | "adjust";
  @ApiProperty() @IsInt() @Min(-2147483647) @Max(2147483647) quantityMilliunits!: number;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) reason!: string;
}
class InventoryIdDto { @ApiProperty() id!: string; }
class InventoryOkDto { @ApiProperty() ok!: boolean; }
class IngredientRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["g", "ml", "unit"] }) unit!: string;
  @ApiProperty() lowStockMilliunits!: number;
  @ApiProperty() onHandMilliunits!: number;
  @ApiProperty() reservedMilliunits!: number;
  @ApiProperty() availableMilliunits!: number;
  @ApiProperty() lowStock!: boolean;
}
class InventoryRecipeRowDto {
  @ApiProperty({ type: String, nullable: true }) replacesIngredientId!: string | null;
  @ApiProperty({ enum: ["product", "modifier"] }) targetKind!: string;
  @ApiProperty() targetId!: string;
  @ApiProperty() ingredientId!: string;
  @ApiProperty() quantityMilliunits!: number;
}
class InventoryTargetDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["product", "modifier"] }) kind!: string;
}
class InventoryMovementRowDto {
  @ApiProperty({ type: Number, nullable: true }) costSatang!: number | null;
  @ApiProperty() id!: string;
  @ApiProperty() ingredientId!: string;
  @ApiProperty({ enum: ["receive", "waste", "adjust", "sale", "remake"] }) kind!: string;
  @ApiProperty() quantityMilliunits!: number;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: String, nullable: true }) actorStaffId!: string | null;
  @ApiProperty({ type: String, nullable: true }) orderId!: string | null;
  @ApiProperty() createdAt!: string;
}
class InventoryStateDto {
  @ApiProperty({ type: IngredientRowDto, isArray: true }) ingredients!: IngredientRowDto[];
  @ApiProperty({ type: InventoryRecipeRowDto, isArray: true }) recipes!: InventoryRecipeRowDto[];
  @ApiProperty({ type: InventoryTargetDto, isArray: true }) targets!: InventoryTargetDto[];
  @ApiProperty({ type: InventoryMovementRowDto, isArray: true }) movements!: InventoryMovementRowDto[];
}

@ApiStandardErrors()
@ApiTags("inventory")
@ApiSecurity("internal-api-token")
@UseGuards(InternalApiGuard)
@Controller("v1/shops/:shopId/inventory")
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly service: InventoryService) {}

  @Get()
  @ApiOkResponse({ type: InventoryStateDto })
  list(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Query("actorStaffId", new ParseUUIDPipe()) actor: string) {
    return this.service.list(shopId, actor);
  }

  @Get('stock-policy')
  @ApiOkResponse({ type: StockPolicyResultDto })
  policy(@Param('shopId', new ParseUUIDPipe()) shop: string, @Query('actorStaffId', new ParseUUIDPipe()) actor: string) {
    return this.service.stockPolicy(shop, actor);
  }

  @Put('stock-policy')
  @ApiOkResponse({ type: StockPolicyResultDto })
  setPolicy(@Param('shopId', new ParseUUIDPipe()) shop: string, @Body() input: StockPolicyDto) {
    return this.service.setStockPolicy(shop, input.actorStaffId, input.mode);
  }

  @Post('orders/:orderId/items/:itemId/remakes')
  @ApiCreatedResponse({ type: InventoryIdDto })
  remake(@Param('shopId', new ParseUUIDPipe()) shop: string, @Param('orderId', new ParseUUIDPipe()) order: string,
    @Param('itemId', new ParseUUIDPipe()) item: string, @Body() input: RemakeDto) {
    return this.service.remake(shop, input.actorStaffId, order, item, input);
  }

  @Post('ingredients/:ingredientId/valuation')
  @ApiCreatedResponse({ type: InventoryIdDto })
  valuation(@Param('shopId', new ParseUUIDPipe()) shop: string, @Param('ingredientId', new ParseUUIDPipe()) ingredient: string, @Body() input: InventoryValuationDto) {
    return this.service.valueStock(shop, input.actorStaffId, ingredient, input);
  }

  @Post("ingredients")
  @ApiCreatedResponse({ type: InventoryIdDto })
  create(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() input: IngredientDto) {
    return this.service.createIngredient(shopId, input.actorStaffId, input);
  }

  @Put("ingredients/:ingredientId/threshold")
  @ApiOkResponse({ type: InventoryIdDto })
  threshold(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Param("ingredientId", new ParseUUIDPipe()) ingredient: string, @Body() input: ThresholdDto) {
    return this.service.setThreshold(shopId, input.actorStaffId, ingredient, input.lowStockMilliunits);
  }

  @Post("ingredients/:ingredientId/movements")
  @ApiCreatedResponse({ type: InventoryIdDto })
  move(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Param("ingredientId", new ParseUUIDPipe()) ingredient: string, @Body() input: InventoryMoveDto) {
    return this.service.move(shopId, input.actorStaffId, ingredient, input);
  }

  @Put("products/:productId/recipe")
  @ApiOkResponse({ type: InventoryOkDto })
  productRecipe(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Param("productId", new ParseUUIDPipe()) product: string, @Body() input: RecipeDto) {
    return this.service.setRecipe(shopId, input.actorStaffId, "product", product, input.lines);
  }

  @Put("modifiers/:modifierId/recipe")
  @ApiOkResponse({ type: InventoryOkDto })
  modifierRecipe(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Param("modifierId", new ParseUUIDPipe()) modifier: string, @Body() input: RecipeDto) {
    return this.service.setRecipe(shopId, input.actorStaffId, "modifier", modifier, input.lines);
  }
}
