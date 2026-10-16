import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { InternalApiGuard } from "./internal-api.guard.js";
import { ReportsService } from "./reports.service.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 365;

function parseDate(value: unknown, name: string): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new BadRequestException(`${name} must be a valid YYYY-MM-DD date`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${name} must be a valid YYYY-MM-DD date`);
  }
  return value;
}

function parseRange(fromValue: unknown, toValue: unknown) {
  const from = parseDate(fromValue, "from");
  const to = parseDate(toValue, "to");
  const days = (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000;
  if (days < 0 || days > MAX_RANGE_DAYS) {
    throw new BadRequestException(`date range must be between 1 and ${MAX_RANGE_DAYS + 1} days`);
  }
  return { from, to };
}

@ApiStandardErrors()
@ApiTags("reports")
@ApiSecurity("internal-api-token")
@Controller("v1/shops/:shopId/reports")
@UseGuards(InternalApiGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Get("sales-summary")
  salesSummary(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.salesSummary(shopId, parseRange(from, to));
  }

  @Get("sales-by-item")
  salesByItem(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.salesByItem(shopId, parseRange(from, to));
  }

  @Get("daily-sales")
  dailySales(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.dailySales(shopId, parseRange(from, to));
  }

  @Get("hourly-sales")
  hourlySales(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.hourlySales(shopId, parseRange(from, to));
  }

  @Get("category-sales")
  categorySales(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.categorySales(shopId, parseRange(from, to));
  }

  @Get("member-growth")
  memberGrowth(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.memberGrowth(shopId, parseRange(from, to));
  }

  @Get("member-overview")
  memberOverview(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.reports.memberOverview(shopId);
  }

  @Get("orders-export")
  ordersForExport(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.ordersForExport(shopId, parseRange(from, to));
  }
}
