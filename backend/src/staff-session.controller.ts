import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiOkResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Controller, Get, Inject, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { StaffSessionService } from "./staff-session.service.js";
import { StaffMembershipDto } from "./core-response.dto.js";

@ApiStandardErrors()
@ApiTags("staff-session")
@ApiSecurity("internal-api-token")
@Controller("v1/auth-users")
@UseGuards(InternalApiGuard)
export class StaffSessionController {
  constructor(@Inject(StaffSessionService) private readonly sessions: StaffSessionService) {}

  @Get(":authUserId/staff-session")
  @ApiOkResponse({ type: StaffMembershipDto, nullable: true })
  getStaffSession(@Param("authUserId", new ParseUUIDPipe()) authUserId: string) {
    return this.sessions.getByAuthUserId(authUserId);
  }

  @Get(":authUserId/shops")
  @ApiOkResponse({ type: StaffMembershipDto, isArray: true })
  listShops(@Param("authUserId", new ParseUUIDPipe()) authUserId: string) {
    return this.sessions.listByAuthUserId(authUserId);
  }

  @Get(":authUserId/shops/:shopId/staff-session")
  @ApiOkResponse({ type: StaffMembershipDto, nullable: true })
  getShopStaffSession(
    @Param("authUserId", new ParseUUIDPipe()) authUserId: string,
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
  ) {
    return this.sessions.getByAuthUserIdAndShopId(authUserId, shopId);
  }
}
