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
import { ApiCreatedResponse, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiErrorDto } from "./common/api-error.dto.js";
import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { CheckoutDto, VoidOrderDto } from "./common/request.dto.js";
import { CheckoutReceiptDto } from "./checkout-receipt.dto.js";
import { InternalApiGuard } from "./internal-api.guard.js";
import { type CheckoutInput, OrdersService } from "./orders.service.js";

type CheckoutRequest = CheckoutInput & { staffId: string };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CHECKOUT_KEYS = ["requestId", "lines", "payment", "staffId", "memberId", "redeemRewardId"];
const CHECKOUT_LINE_KEYS = ["productId", "qty", "modifierIds", "note"];
const CHECKOUT_PAYMENT_KEYS = ["method", "cashReceivedSatang"];

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function parseCheckout(value: unknown): CheckoutRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("invalid checkout payload");
  }
  const body = value as Record<string, unknown>;
  const { lines, payment } = body;
  const uuid = (input: unknown) => typeof input === "string" && UUID_PATTERN.test(input);
  if (!hasOnlyKeys(body, CHECKOUT_KEYS)
    || !Array.isArray(lines) || lines.length > 100 || !payment || typeof payment !== "object" || Array.isArray(payment)) {
    throw new BadRequestException("invalid checkout payload");
  }
  const validLines = lines.every((line) => {
    if (!line || typeof line !== "object" || Array.isArray(line)) {
      return false;
    }
    const lineValue = line as Record<string, unknown>;
    if (!hasOnlyKeys(lineValue, CHECKOUT_LINE_KEYS)) {
      return false;
    }
    const { modifierIds, productId, qty, note } = lineValue;
    return uuid(productId)
      && Number.isSafeInteger(qty)
      && Array.isArray(modifierIds)
      && modifierIds.length <= 30
      && modifierIds.every(uuid)
      && (note === undefined || typeof note === "string");
  });
  const paymentValue = payment as Record<string, unknown>;
  const validPayment = hasOnlyKeys(paymentValue, CHECKOUT_PAYMENT_KEYS)
    && (paymentValue.method === "promptpay"
      || (paymentValue.method === "cash" && Number.isSafeInteger(paymentValue.cashReceivedSatang)));
  if (!validLines || !validPayment || !uuid(body.staffId)
    || (body.requestId !== undefined && !uuid(body.requestId))
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
  @ApiOperation({
    summary: "Create or replay a checkout",
    description: "Returns the committed receipt. A request key replay returns the stored receipt with replayed=true.",
  })
  @ApiCreatedResponse({ type: CheckoutReceiptDto, description: "Committed checkout receipt; replayed identifies an idempotent retry." })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: "Invalid checkout or PromptPay is not configured (code: promptpay_not_configured).",
  })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: "The idempotency key was reused with a different checkout (code: idempotency_key_reused).",
  })
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
