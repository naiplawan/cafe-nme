import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";

@Injectable()
export class RateLimitService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async consume(key: string, limit: number, windowSeconds: number, now: Date): Promise<boolean> {
    const keyHash = createHash("sha256").update(key).digest("hex");
    const nowIso = now.toISOString();
    const expiresBeforeIso = new Date(now.getTime() - windowSeconds * 1000).toISOString();
    const rows = await this.database.connection<{ attempts: number }[]>`
      insert into rate_limit_attempts (key, attempts, window_started_at)
      values (${keyHash}, 1, ${nowIso}::timestamptz)
      on conflict (key) do update set
        window_started_at = case
          when rate_limit_attempts.window_started_at <= ${expiresBeforeIso}::timestamptz
            then ${nowIso}::timestamptz
          else rate_limit_attempts.window_started_at
        end,
        attempts = case
          when rate_limit_attempts.window_started_at <= ${expiresBeforeIso}::timestamptz then 1
          when rate_limit_attempts.attempts <= ${limit} then rate_limit_attempts.attempts + 1
          else ${limit + 1}
        end
      returning attempts
    `;

    return rows[0].attempts <= limit;
  }
}
