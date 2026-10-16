import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { RateLimitDto } from "./common/request.dto.js";
import { BadRequestException, Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { RateLimitService } from "./rate-limit.service.js";

const MAX_KEY_LENGTH = 4096;
const MAX_LIMIT = 2_147_483_646;
const MAX_WINDOW_SECONDS = 31_536_000;

function parseRequest(value: unknown): { key: string; limit: number; windowSeconds: number; now: Date } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("invalid rate-limit payload");
  }
  const body = value as Record<string, unknown>;
  if (typeof body.key !== "string" || body.key.length === 0 || body.key.length > MAX_KEY_LENGTH
    || !Number.isSafeInteger(body.limit) || (body.limit as number) < 1 || (body.limit as number) > MAX_LIMIT
    || !Number.isSafeInteger(body.windowSeconds) || (body.windowSeconds as number) < 1
    || (body.windowSeconds as number) > MAX_WINDOW_SECONDS
    || typeof body.now !== "string") {
    throw new BadRequestException("invalid rate-limit payload");
  }

  const now = new Date(body.now);
  if (!Number.isFinite(now.valueOf()) || now.toISOString() !== body.now) {
    throw new BadRequestException("now must be a valid ISO timestamp");
  }

  return {
    key: body.key,
    limit: body.limit as number,
    windowSeconds: body.windowSeconds as number,
    now,
  };
}

@ApiStandardErrors()
@ApiTags("rate-limit")
@ApiSecurity("internal-api-token")
@Controller("v1/rate-limits")
@UseGuards(InternalApiGuard)
export class RateLimitController {
  constructor(@Inject(RateLimitService) private readonly rateLimit: RateLimitService) {}

  @Post("consume")
  async consume(@Body() value: RateLimitDto): Promise<{ allowed: boolean }> {
    const input = parseRequest(value);
    return { allowed: await this.rateLimit.consume(input.key, input.limit, input.windowSeconds, input.now) };
  }
}
