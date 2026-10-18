import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Controller, Get, Inject, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { StaffSessionService } from "./staff-session.service.js";

@ApiStandardErrors()
@ApiTags("staff-session")
@ApiSecurity("internal-api-token")
@Controller("v1/auth-users")
@UseGuards(InternalApiGuard)
export class StaffSessionController {
  constructor(@Inject(StaffSessionService) private readonly sessions: StaffSessionService) {}

  @Get(":authUserId/staff-session")
  getStaffSession(@Param("authUserId", new ParseUUIDPipe()) authUserId: string) {
    return this.sessions.getByAuthUserId(authUserId);
  }

  @Get(":authUserId/shops")
  listShops(@Param("authUserId", new ParseUUIDPipe()) authUserId: string) {
    return this.sessions.listByAuthUserId(authUserId);
  }

  @Get(":authUserId/shops/:shopId/staff-session")
  getShopStaffSession(
    @Param("authUserId", new ParseUUIDPipe()) authUserId: string,
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
  ) {
    return this.sessions.getByAuthUserIdAndShopId(authUserId, shopId);
  }
}
