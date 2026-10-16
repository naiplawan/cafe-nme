import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { SetupShopDto } from "./common/request.dto.js";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { ShopSetupService } from "./shop-setup.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROMPTPAY_ID = /^(0\d{9}|\d{13})$/;
const SHOP_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PIN = /^\d{4,6}$/;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Request body must be an object");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new BadRequestException(`${name} is invalid`);
  }
  return value.trim();
}

function uuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new BadRequestException(`${name} must be a UUID`);
  }
  return value;
}

function setupPayload(value: unknown) {
  const body = object(value);
  const { authUserId, shopName, slug: rawSlug, ownerName, promptpayId, pin } = body;
  if (promptpayId !== null && typeof promptpayId !== "string") {
    throw new BadRequestException("promptpayId is invalid");
  }
  if (typeof promptpayId === "string" && !PROMPTPAY_ID.test(promptpayId)) {
    throw new BadRequestException("promptpayId is invalid");
  }
  const slug = text(rawSlug, "slug", 90);
  if (!SHOP_SLUG.test(slug)) {
    throw new BadRequestException("slug is invalid");
  }
  if (typeof pin !== "string" || !PIN.test(pin)) {
    throw new BadRequestException("PIN must be 4 to 6 digits");
  }
  return {
    authUserId: uuid(authUserId, "authUserId"),
    shopName: text(shopName, "shopName", 80),
    slug,
    ownerName: text(ownerName, "ownerName", 80),
    promptpayId: promptpayId as string | null,
    pin,
  };
}

@ApiStandardErrors()
@ApiTags("shop-setup")
@ApiSecurity("internal-api-token")
@Controller("v1")
@UseGuards(InternalApiGuard)
export class ShopSetupController {
  constructor(@Inject(ShopSetupService) private readonly setup: ShopSetupService) {}

  @Get("auth-users/:authUserId/owner-shop")
  ownerShopExists(@Param("authUserId", new ParseUUIDPipe()) authUserId: string) {
    return this.setup.ownerShopExists(authUserId).then((exists) => ({ exists }));
  }

  @Post("shops/setup")
  createShop(@Body() body: SetupShopDto) {
    return this.setup.createShop(setupPayload(body));
  }
}
