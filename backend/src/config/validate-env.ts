export interface RuntimeEnvironment {
  API_PORT: number;
  DATABASE_URL: string;
  INTERNAL_API_SECRET: string;
  APP_SECRET?: string;
  LINE_DEV_MOCK?: string;
  NODE_ENV?: string;
}

export function validateEnvironment(environment: Record<string, unknown>): RuntimeEnvironment {
  const databaseUrl = environment.DATABASE_URL;
  if (typeof databaseUrl !== "string") {
    throw new Error("DATABASE_URL is required");
  }
  let parsedDatabaseUrl: URL;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch (error) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL", { cause: error });
  }
  if (!["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol)) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  const internalApiSecret = environment.INTERNAL_API_SECRET ?? environment.APP_SECRET;
  if (typeof internalApiSecret !== "string" || internalApiSecret.length < 32) {
    throw new Error("INTERNAL_API_SECRET must be at least 32 characters");
  }

  const rawPort = environment.API_PORT ?? environment.PORT ?? "3101";
  const port = typeof rawPort === "number" ? rawPort : Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("API_PORT must be an integer between 1 and 65535");
  }

  const lineDevMock = environment.LINE_DEV_MOCK;
  if (lineDevMock !== undefined && lineDevMock !== "0" && lineDevMock !== "1") {
    throw new Error("LINE_DEV_MOCK must be 0 or 1");
  }
  if (lineDevMock === "1" && environment.NODE_ENV !== "development") {
    throw new Error("LINE_DEV_MOCK=1 is allowed only when NODE_ENV=development");
  }

  return {
    API_PORT: port,
    DATABASE_URL: databaseUrl,
    INTERNAL_API_SECRET: internalApiSecret,
    ...(typeof environment.APP_SECRET === "string" ? { APP_SECRET: environment.APP_SECRET } : {}),
    ...(typeof lineDevMock === "string" ? { LINE_DEV_MOCK: lineDevMock } : {}),
    ...(typeof environment.NODE_ENV === "string" ? { NODE_ENV: environment.NODE_ENV } : {}),
  };
}
