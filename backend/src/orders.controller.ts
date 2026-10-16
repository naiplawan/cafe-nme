import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { CheckoutDto, VoidOrderDto } from "./common/request.dto.js";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { OrdersService, type CheckoutInput } from "./orders.service.js";

type CheckoutRequest = CheckoutInput & { staffId: string };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseCheckout(value: unknown): CheckoutRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("invalid checkout payload");
  }
  const body = value as Record<string, unknown>;
  const { lines, payment } = body;
  const uuid = (input: unknown) => typeof input === "string" && UUID_PATTERN.test(input);
  if (!Array.isArray(lines) || lines.length > 100 || !payment || typeof payment !== "object") {
    throw new BadRequestException("invalid checkout payload");
  }
  const validLines = lines.every((line) => {
    if (!line || typeof line !== "object" || Array.isArray(line)) {
      return false;
    }
    const { modifierIds, productId, qty, note } = line as Record<string, unknown>;
    return uuid(productId)
      && Number.isSafeInteger(qty)
      && Array.isArray(modifierIds)
      && modifierIds.length <= 30
      && modifierIds.every(uuid)
      && (note === undefined || typeof note === "string");
  });
  const paymentValue = payment as Record<string, unknown>;
  const validPayment = paymentValue.method === "promptpay"
    || (paymentValue.method === "cash" && Number.isSafeInteger(paymentValue.cashReceivedSatang));
  if (!validLines || !validPayment || !uuid(body.staffId)
    || (body.memberId !== undefined && body.memberId !== null && !uuid(body.memberId))
    || (body.redeemRewardId !== undefined && body.redeemRewardId !== null && !uuid(body.redeemRewardId))) {
    throw new BadRequestException("invalid checkout payload");
  }
  return body as unknown as CheckoutRequest;
}

@ApiStandardErrors()
@ApiTags("orders")
@ApiSecurity("internal-api-token")
@Controller("v1/shops/:shopId/orders")
@UseGuards(InternalApiGuard)
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Post()
  checkout(@Param("shopId", new ParseUUIDPipe()) shopId: string, @Body() body: CheckoutDto) {
    const checkout = parseCheckout(body);
    return this.orders.checkout(shopId, checkout.staffId, checkout);
  }

  @Get("promptpay-config")
  getPromptPayId(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.orders.getPromptPayId(shopId);
  }

  @Get(":orderId/receipt-recipient")
  getReceiptRecipient(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
  ) {
    return this.orders.getReceiptRecipient(shopId, orderId);
  }

  @Get()
  list(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("date") date: string | undefined,
  ) {
    const parsed = date && DATE_PATTERN.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
    if (!date || !parsed || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException("date must be a valid YYYY-MM-DD date");
    }
    return this.orders.listOrdersForDay(shopId, date);
  }

  @Get(":orderId")
  get(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
  ) {
    return this.orders.getOrder(shopId, orderId);
  }

  @Post(":orderId/void")
  void(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Body() body: VoidOrderDto,
  ) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("managerStaffId must be a valid UUID");
    }
    const { managerStaffId } = body;
    if (typeof managerStaffId !== "string" || !UUID_PATTERN.test(managerStaffId)) {
      throw new BadRequestException("managerStaffId must be a valid UUID");
    }
    return this.orders.voidOrder(shopId, orderId, managerStaffId)
      .then(() => ({ ok: true }));
  }
}
