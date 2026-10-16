import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
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

@ApiStandardErrors()
@ApiTags("menu")
@ApiSecurity("internal-api-token")
@Controller("v1/shops/:shopId/menu")
@UseGuards(InternalApiGuard)
export class MenuController {
  constructor(@Inject(MenuService) private readonly menu: MenuService) {}

  @Get()
  getMenu(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.menu.getMenu(shopId);
  }

  @Patch("settings")
  updateSettings(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: MenuSettingsDto) {
    return this.menu.updateSettings(shopId, body);
  }

  @Post("categories")
  createCategory(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: CreateCategoryDto) {
    return this.menu.createCategory(shopId, body);
  }

  @Post("categories/reorder")
  reorderCategories(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: CategoryIdsDto) {
    return this.menu.reorderCategories(shopId, body);
  }

  @Patch("categories/:categoryId")
  renameCategory(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("categoryId", new ParseUUIDPipe()) categoryId: string,
    @Body() body: CreateCategoryDto,
  ) {
    return this.menu.renameCategory(shopId, categoryId, body);
  }

  @Delete("categories/:categoryId")
  deleteCategory(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("categoryId", new ParseUUIDPipe()) categoryId: string,
  ) {
    return this.menu.deleteCategory(shopId, categoryId);
  }

  @Post("products")
  createProduct(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: ProductDto) {
    return this.menu.createProduct(shopId, body);
  }

  @Get("products/:productId")
  getProduct(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ) {
    return this.menu.getProduct(shopId, productId);
  }

  @Post("products/:productId/toggle-sold-out")
  toggleProductSoldOut(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ) {
    return this.menu.toggleProductSoldOut(shopId, productId);
  }

  @Patch("products/:productId")
  updateProduct(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() body: ProductDto,
  ) {
    return this.menu.updateProduct(shopId, productId, body);
  }

  @Delete("products/:productId")
  deleteProduct(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ) {
    return this.menu.deleteProduct(shopId, productId);
  }

  @Post("products/bulk")
  bulkUpdateProducts(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: BulkProductUpdateDto) {
    return this.menu.bulkUpdateProducts(shopId, body);
  }

  @Post("products/reorder")
  reorderProducts(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: ProductIdsDto) {
    return this.menu.reorderProducts(shopId, body);
  }

  @Post("products/import-stock")
  importStock(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.menu.importStock(shopId);
  }

  @Post("products/clear-sold-out")
  clearSoldOut(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.menu.clearSoldOut(shopId);
  }
}
