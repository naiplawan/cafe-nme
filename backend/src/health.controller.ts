import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { DatabaseService } from "./database.service.js";

@Controller("health")
@ApiTags("health")
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  @Get()
  @ApiOperation({ summary: "Check process liveness" })
  @ApiResponse({ status: 200, description: "Process is alive" })
  getHealth() {
    return { status: "ok" };
  }

  @Get("ready")
  @ApiOperation({ summary: "Check database readiness" })
  @ApiResponse({ status: 200, description: "Database is ready" })
  @ApiResponse({ status: 503, description: "Database is unavailable" })
  async getReadiness(): Promise<{ status: "ready" }> {
    try {
      await this.database.connection`select 1`;
      return { status: "ready" };
    } catch (error) {
      throw new ServiceUnavailableException("Database is unavailable", { cause: error });
    }
  }
}
