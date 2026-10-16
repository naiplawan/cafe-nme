import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import postgres, { type Sql } from "postgres";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private client: Sql | undefined;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  get connection(): Sql {
    if (!this.client) {
      const connectionString = this.config.getOrThrow<string>("DATABASE_URL");
      this.client = postgres(connectionString, { prepare: false, max: 5 });
    }
    return this.client;
  }

  async onModuleDestroy() {
    await this.client?.end();
  }
}
