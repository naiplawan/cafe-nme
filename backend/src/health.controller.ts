import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { DatabaseService } from "./database.service.js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8")) as {
  entries: { tag: string; when: number }[];
};
const migration = journal.entries[journal.entries.length - 1];
const migrationHash = createHash("sha256")
  .update(readFileSync(new URL(`../drizzle/${migration.tag}.sql`, import.meta.url)))
  .digest("hex");

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
  @ApiOperation({ summary: "Check database connectivity and required migration readiness" })
  @ApiResponse({ status: 200, description: "Database is ready" })
  @ApiResponse({ status: 503, description: "Database is unavailable" })
  async getReadiness(): Promise<{ status: "ready" }> {
    try {
      const applied = await this.database.connection`
        select id from drizzle.__drizzle_migrations
        where created_at = ${migration.when} and hash = ${migrationHash} limit 1
      `;
      if (applied.length === 0) {
        throw new Error("Required database migration is not applied");
      }
      return { status: "ready" };
    } catch (error) {
      throw new ServiceUnavailableException("Database is unavailable", { cause: error });
    }
  }
}
