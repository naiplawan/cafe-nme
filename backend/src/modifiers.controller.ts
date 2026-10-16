import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ModifierGroupDto, ModifierOptionDto, ProductIdsDto } from "./common/request.dto.js";
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
  Put,
  UseGuards,
} from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { ModifiersService } from "./modifiers.service.js";

@ApiStandardErrors()
@ApiTags("modifiers")
@ApiSecurity("internal-api-token")
@Controller("v1/shops/:shopId/modifiers")
@UseGuards(InternalApiGuard)
export class ModifiersController {
  constructor(@Inject(ModifiersService) private readonly modifiers: ModifiersService) {}

  @Get()
  list(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.modifiers.list(shopId);
  }

  @Post("groups")
  createGroup(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: ModifierGroupDto) {
    return this.modifiers.createGroup(shopId, body);
  }

  @Post("groups/standard")
  createStandardGroups(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.modifiers.createStandardGroups(shopId);
  }

  @Patch("groups/:groupId")
  updateGroup(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("groupId", new ParseUUIDPipe()) groupId: string,
    @Body() body: ModifierGroupDto,
  ) {
    return this.modifiers.updateGroup(shopId, groupId, body);
  }

  @Delete("groups/:groupId")
  deleteGroup(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("groupId", new ParseUUIDPipe()) groupId: string,
  ) {
    return this.modifiers.deleteGroup(shopId, groupId);
  }

  @Put("groups/:groupId/products")
  setGroupProducts(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("groupId", new ParseUUIDPipe()) groupId: string,
    @Body() body: ProductIdsDto,
  ) {
    return this.modifiers.setGroupProducts(shopId, groupId, body);
  }

  @Post("groups/:groupId/options")
  createOption(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("groupId", new ParseUUIDPipe()) groupId: string,
    @Body() body: ModifierOptionDto,
  ) {
    return this.modifiers.createOption(shopId, groupId, body);
  }

  @Patch("options/:modifierId")
  updateOption(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("modifierId", new ParseUUIDPipe()) modifierId: string,
    @Body() body: ModifierOptionDto,
  ) {
    return this.modifiers.updateOption(shopId, modifierId, body);
  }

  @Delete("options/:modifierId")
  deleteOption(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("modifierId", new ParseUUIDPipe()) modifierId: string,
  ) {
    return this.modifiers.deleteOption(shopId, modifierId);
  }
}
