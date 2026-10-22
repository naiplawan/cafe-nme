import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiOkResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
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
import { CategorySalesDto, DailySalesDto, HourlySalesDto, MemberGrowthDto, MemberOverviewDto, SalesByItemDto } from "./core-response.dto.js";
import { OrdersExportResponseDto, SalesSummaryResponseDto } from "./rest-response.dto.js";

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
  @ApiOkResponse({ type: SalesSummaryResponseDto })
  salesSummary(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.salesSummary(shopId, parseRange(from, to));
  }

  @Get("sales-by-item")
  @ApiOkResponse({ type: SalesByItemDto, isArray: true })
  salesByItem(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.salesByItem(shopId, parseRange(from, to));
  }

  @Get("daily-sales")
  @ApiOkResponse({ type: DailySalesDto, isArray: true })
  dailySales(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.dailySales(shopId, parseRange(from, to));
  }

  @Get("hourly-sales")
  @ApiOkResponse({ type: HourlySalesDto, isArray: true })
  hourlySales(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.hourlySales(shopId, parseRange(from, to));
  }

  @Get("category-sales")
  @ApiOkResponse({ type: CategorySalesDto, isArray: true })
  categorySales(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.categorySales(shopId, parseRange(from, to));
  }

  @Get("member-growth")
  @ApiOkResponse({ type: MemberGrowthDto, isArray: true })
  memberGrowth(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.memberGrowth(shopId, parseRange(from, to));
  }

  @Get("member-overview")
  @ApiOkResponse({ type: MemberOverviewDto })
  memberOverview(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.reports.memberOverview(shopId);
  }

  @Get("orders-export")
  @ApiOkResponse({ type: OrdersExportResponseDto, isArray: true })
  ordersForExport(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
  ) {
    return this.reports.ordersForExport(shopId, parseRange(from, to));
  }
}
