import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiCreatedResponse, ApiOkResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { BulkProductUpdateDto, CategoryIdsDto, CreateCategoryDto, MenuSettingsDto, ProductDto, ProductIdsDto } from "./common/request.dto.js";
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { MenuService } from "./menu.service.js";
import { IdResultDto, MenuProductDetailResponseDto, MenuProductMutationResponseDto, MenuCategoryResponseDto, MenuResponseDto, MenuSettingsResponseDto, ProductSoldOutResponseDto, StockImportResponseDto } from "./rest-response.dto.js";

@ApiStandardErrors()
@ApiTags("menu")
@ApiSecurity("internal-api-token")
@Controller("v1/shops/:shopId/menu")
@UseGuards(InternalApiGuard)
export class MenuController {
  constructor(@Inject(MenuService) private readonly menu: MenuService) {}

  @Get()
  @ApiOkResponse({ type: MenuResponseDto })
  getMenu(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.menu.getMenu(shopId);
  }

  @Patch("settings")
  @ApiOkResponse({ type: MenuSettingsResponseDto })
  updateSettings(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: MenuSettingsDto) {
    return this.menu.updateSettings(shopId, body);
  }

  @Post("categories")
  @ApiCreatedResponse({ type: MenuCategoryResponseDto, isArray: true })
  createCategory(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: CreateCategoryDto) {
    return this.menu.createCategory(shopId, body);
  }

  @Post("categories/reorder")
  @ApiCreatedResponse({ type: IdResultDto, isArray: true })
  reorderCategories(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: CategoryIdsDto) {
    return this.menu.reorderCategories(shopId, body);
  }

  @Patch("categories/:categoryId")
  @ApiOkResponse({ type: MenuCategoryResponseDto, isArray: true })
  renameCategory(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("categoryId", new ParseUUIDPipe()) categoryId: string,
    @Body() body: CreateCategoryDto,
  ) {
    return this.menu.renameCategory(shopId, categoryId, body);
  }

  @Delete("categories/:categoryId")
  @ApiOkResponse({ type: IdResultDto, isArray: true })
  deleteCategory(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("categoryId", new ParseUUIDPipe()) categoryId: string,
  ) {
    return this.menu.deleteCategory(shopId, categoryId);
  }

  @Post("products")
  @ApiCreatedResponse({ type: MenuProductMutationResponseDto, isArray: true })
  createProduct(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: ProductDto) {
    return this.menu.createProduct(shopId, body);
  }

  @Get("products/:productId")
  @ApiOkResponse({ type: MenuProductDetailResponseDto })
  getProduct(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ) {
    return this.menu.getProduct(shopId, productId);
  }

  @Post("products/:productId/toggle-sold-out")
  @ApiCreatedResponse({ type: ProductSoldOutResponseDto, nullable: true })
  toggleProductSoldOut(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ) {
    return this.menu.toggleProductSoldOut(shopId, productId);
  }

  @Patch("products/:productId")
  @ApiOkResponse({ type: IdResultDto, isArray: true })
  updateProduct(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() body: ProductDto,
  ) {
    return this.menu.updateProduct(shopId, productId, body);
  }

  @Delete("products/:productId")
  @ApiOkResponse({ type: IdResultDto, isArray: true })
  deleteProduct(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ) {
    return this.menu.deleteProduct(shopId, productId);
  }

  @Post("products/bulk")
  @ApiCreatedResponse({ type: IdResultDto, isArray: true })
  bulkUpdateProducts(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: BulkProductUpdateDto) {
    return this.menu.bulkUpdateProducts(shopId, body);
  }

  @Post("products/reorder")
  @ApiCreatedResponse({ type: IdResultDto, isArray: true })
  reorderProducts(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: ProductIdsDto) {
    return this.menu.reorderProducts(shopId, body);
  }

  @Post("products/import-stock")
  @ApiCreatedResponse({ type: StockImportResponseDto })
  importStock(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.menu.importStock(shopId);
  }

  @Post("products/clear-sold-out")
  @ApiCreatedResponse({ type: IdResultDto, isArray: true })
  clearSoldOut(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.menu.clearSoldOut(shopId);
  }
}
