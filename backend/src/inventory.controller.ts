import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiProperty, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { InternalApiGuard } from "./internal-api.guard.js";
import { InventoryService } from "./inventory.service.js";

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
  @ApiProperty() @IsUUID() ingredientId!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(2147483647) quantityMilliunits!: number;
}
class RecipeDto {
  @ApiProperty() @IsUUID() actorStaffId!: string;
  @ApiProperty({ type: RecipeLineDto, isArray: true }) @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => RecipeLineDto) lines!: RecipeLineDto[];
}
class InventoryMoveDto {
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
  @ApiProperty() lowStock!: boolean;
}
class InventoryRecipeRowDto {
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
  @ApiProperty() id!: string;
  @ApiProperty() ingredientId!: string;
  @ApiProperty({ enum: ["receive", "waste", "adjust", "sale"] }) kind!: string;
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
