import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiCreatedResponse, ApiOkResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { CreateMemberDto, StampAdjustmentDto } from "./common/request.dto.js";
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { MembersService } from "./members.service.js";
import { MemberIdResponseDto, MemberListResponseDto, MemberResponseDto, MemberSummaryResponseDto, OkResultDto, StampLedgerResponseDto } from "./rest-response.dto.js";

@ApiStandardErrors()
@ApiTags("members")
@ApiSecurity("internal-api-token")
@Controller("v1/shops/:shopId/members")
@UseGuards(InternalApiGuard)
export class MembersController {
  constructor(@Inject(MembersService) private readonly members: MembersService) {}

  @Get("by-token/:memberId")
  @ApiOkResponse({ type: MemberIdResponseDto, nullable: true })
  findByToken(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("memberId", new ParseUUIDPipe()) memberId: string,
  ) {
    return this.members.findById(shopId, memberId);
  }

  @Get("by-phone")
  @ApiOkResponse({ type: MemberResponseDto, isArray: true })
  findByPhone(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("phone") phone: string,
  ) {
    return this.members.findByPhone(shopId, phone ?? "");
  }

  @Get()
  @ApiOkResponse({ type: MemberListResponseDto })
  list(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("search") search?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("availableReward") availableReward?: string,
  ) {
    return this.members.list(shopId, { search, limit, offset, availableReward });
  }

  @Post()
  @ApiCreatedResponse({ type: MemberResponseDto })
  create(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: CreateMemberDto) {
    return this.members.createByPhone(shopId, body);
  }

  @Delete(":memberId/personal-data")
  @ApiOkResponse({ type: OkResultDto })
  deletePersonalData(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("memberId", new ParseUUIDPipe()) memberId: string,
  ) {
    return this.members.deletePersonalData(shopId, memberId);
  }

  @Get(":memberId/summary")
  @ApiOkResponse({ type: MemberSummaryResponseDto, nullable: true })
  getSummary(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("memberId", new ParseUUIDPipe()) memberId: string,
  ) {
    return this.members.getSummary(shopId, memberId);
  }

  @Get(":memberId/ledger")
  @ApiOkResponse({ type: StampLedgerResponseDto, isArray: true })
  listLedger(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("memberId", new ParseUUIDPipe()) memberId: string,
    @Query("limit") limit?: string,
  ) {
    return this.members.listLedger(shopId, memberId, limit);
  }

  @Post(":memberId/stamp-adjustments")
  @ApiCreatedResponse({ type: MemberSummaryResponseDto })
  adjustStamps(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("memberId", new ParseUUIDPipe()) memberId: string,
    @Body() body: StampAdjustmentDto,
  ) {
    return this.members.adjustStamps(shopId, memberId, body);
  }
}
