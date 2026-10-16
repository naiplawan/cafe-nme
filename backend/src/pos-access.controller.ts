import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import {
  ActorDto,
  DeviceCreateDto,
  DeviceTokenDto,
  ManagerPinDto,
  PairingCodeDto,
  StaffActiveDto,
  StaffCreateDto,
  StaffLoginDto,
  StaffPinDto,
} from "./common/request.dto.js";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { PosAccessService } from "./pos-access.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException("Request body must be an object");
  return value as Record<string, unknown>;
}
function text(value: unknown, name: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new BadRequestException(`${name} is invalid`);
  return value.trim();
}
function uuid(value: unknown, name: string) {
  if (typeof value !== "string" || !UUID.test(value)) throw new BadRequestException(`${name} must be a UUID`);
  return value;
}
function pin(value: unknown) {
  if (typeof value !== "string" || !/^\d{4,6}$/.test(value)) throw new BadRequestException("PIN must be 4 to 6 digits");
  return value;
}

@ApiStandardErrors()
@ApiTags("pos-access")
@ApiSecurity("internal-api-token")
@Controller("v1")
@UseGuards(InternalApiGuard)
export class PosAccessController {
  constructor(@Inject(PosAccessService) private readonly access: PosAccessService) {}

  @Post("shops/:shopId/pos-devices")
  createDevice(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() value: DeviceCreateDto) {
    const body = object(value);
    return this.access.createDevice(shopId, uuid(body.actorStaffId, "actorStaffId"), text(body.name, "name", 80));
  }

  @Get("shops/:shopId/pos-devices")
  listDevices(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Query("actorStaffId") actorStaffId: string) {
    return this.access.listDevices(shopId, uuid(actorStaffId, "actorStaffId"));
  }

  @Post("shops/:shopId/pos-devices/:deviceId/pairing-code")
  regenerateCode(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("deviceId", new ParseUUIDPipe()) deviceId: string,
    @Body() value: ActorDto,
  ) {
    return this.access.regeneratePairingCode(shopId, uuid(object(value).actorStaffId, "actorStaffId"), deviceId);
  }

  @Delete("shops/:shopId/pos-devices/:deviceId")
  removeDevice(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("deviceId", new ParseUUIDPipe()) deviceId: string,
    @Query("actorStaffId") actorStaffId: string,
  ) {
    return this.access.removeDevice(shopId, uuid(actorStaffId, "actorStaffId"), deviceId);
  }

  @Post("pos/pair")
  async pairDevice(@Body() value: PairingCodeDto) {
    const device = await this.access.pairDevice(text(object(value).code, "code", 6));
    if (!device) throw new NotFoundException("Pairing code is invalid or expired");
    return device;
  }

  @Post("pos/device")
  getDevice(@Body() value: DeviceTokenDto) {
    const deviceToken = text(object(value).deviceToken, "deviceToken", 128);
    return this.access.getDevice(deviceToken);
  }

  @Post("shops/:shopId/pos-staff/list")
  listPosStaff(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() value: DeviceTokenDto) {
    return this.access.listPosStaff(shopId, text(object(value).deviceToken, "deviceToken", 128));
  }

  @Post("shops/:shopId/pos-staff/login")
  loginStaff(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() value: StaffLoginDto) {
    const body = object(value);
    return this.access.loginStaff(shopId, text(body.deviceToken, "deviceToken", 128), uuid(body.staffId, "staffId"), pin(body.pin));
  }

  @Get("shops/:shopId/pos-staff/:staffId")
  getActiveStaff(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("staffId", new ParseUUIDPipe()) staffId: string,
  ) {
    return this.access.getActiveStaff(shopId, staffId);
  }

  @Post("shops/:shopId/pos-staff/manager-pin")
  verifyManagerPin(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() value: ManagerPinDto) {
    const body = object(value);
    return this.access.verifyManagerPin(shopId, uuid(body.actorStaffId, "actorStaffId"), pin(body.pin));
  }

  @Get("shops/:shopId/staff")
  listStaff(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Query("actorStaffId") actorStaffId: string) {
    return this.access.listStaff(shopId, uuid(actorStaffId, "actorStaffId"));
  }

  @Post("shops/:shopId/staff")
  createStaff(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() value: StaffCreateDto) {
    const body = object(value);
    const role = text(body.role, "role", 16);
    if (!["owner", "manager", "barista"].includes(role)) throw new BadRequestException("role is invalid");
    return this.access.createStaff(shopId, uuid(body.actorStaffId, "actorStaffId"), {
      name: text(body.name, "name", 80), role, pin: pin(body.pin),
    });
  }

  @Post("shops/:shopId/staff/:staffId/pin")
  setStaffPin(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("staffId", new ParseUUIDPipe()) staffId: string,
    @Body() value: StaffPinDto,
  ) {
    const body = object(value);
    return this.access.setStaffPin(shopId, uuid(body.actorStaffId, "actorStaffId"), staffId, pin(body.pin));
  }

  @Post("shops/:shopId/staff/:staffId/active")
  setStaffActive(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("staffId", new ParseUUIDPipe()) staffId: string,
    @Body() value: StaffActiveDto,
  ) {
    const body = object(value);
    if (typeof body.active !== "boolean") throw new BadRequestException("active must be boolean");
    return this.access.setStaffActive(shopId, uuid(body.actorStaffId, "actorStaffId"), staffId, body.active);
  }
}
