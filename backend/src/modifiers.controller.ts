import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiCreatedResponse, ApiOkResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
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
import { IdResultDto, ModifierGroupResponseDto, StandardGroupsResultDto, SuccessResultDto } from "./rest-response.dto.js";

@ApiStandardErrors()
@ApiTags("modifiers")
@ApiSecurity("internal-api-token")
@Controller("v1/shops/:shopId/modifiers")
@UseGuards(InternalApiGuard)
export class ModifiersController {
  constructor(@Inject(ModifiersService) private readonly modifiers: ModifiersService) {}

  @Get()
  @ApiOkResponse({ type: ModifierGroupResponseDto, isArray: true })
  list(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.modifiers.list(shopId);
  }

  @Post("groups")
  @ApiCreatedResponse({ type: IdResultDto })
  createGroup(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: ModifierGroupDto) {
    return this.modifiers.createGroup(shopId, body);
  }

  @Post("groups/standard")
  @ApiCreatedResponse({ type: StandardGroupsResultDto })
  createStandardGroups(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.modifiers.createStandardGroups(shopId);
  }

  @Patch("groups/:groupId")
  @ApiOkResponse({ type: IdResultDto, isArray: true })
  updateGroup(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("groupId", new ParseUUIDPipe()) groupId: string,
    @Body() body: ModifierGroupDto,
  ) {
    return this.modifiers.updateGroup(shopId, groupId, body);
  }

  @Delete("groups/:groupId")
  @ApiOkResponse({ type: IdResultDto, isArray: true })
  deleteGroup(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("groupId", new ParseUUIDPipe()) groupId: string,
  ) {
    return this.modifiers.deleteGroup(shopId, groupId);
  }

  @Put("groups/:groupId/products")
  @ApiOkResponse({ type: SuccessResultDto })
  setGroupProducts(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("groupId", new ParseUUIDPipe()) groupId: string,
    @Body() body: ProductIdsDto,
  ) {
    return this.modifiers.setGroupProducts(shopId, groupId, body);
  }

  @Post("groups/:groupId/options")
  @ApiCreatedResponse({ type: IdResultDto })
  createOption(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("groupId", new ParseUUIDPipe()) groupId: string,
    @Body() body: ModifierOptionDto,
  ) {
    return this.modifiers.createOption(shopId, groupId, body);
  }

  @Patch("options/:modifierId")
  @ApiOkResponse({ type: IdResultDto, isArray: true })
  updateOption(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("modifierId", new ParseUUIDPipe()) modifierId: string,
    @Body() body: ModifierOptionDto,
  ) {
    return this.modifiers.updateOption(shopId, modifierId, body);
  }

  @Delete("options/:modifierId")
  @ApiOkResponse({ type: IdResultDto, isArray: true })
  deleteOption(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("modifierId", new ParseUUIDPipe()) modifierId: string,
  ) {
    return this.modifiers.deleteOption(shopId, modifierId);
  }
}
