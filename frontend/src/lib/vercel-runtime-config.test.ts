import { describe, expect, it } from "vitest";
import { validateEnvironment } from "../../../backend/src/config/validate-env";

describe("Vercel backend configuration", () => {
  it("uses Vercel's assigned port when API_PORT is unset", () => {
    expect(validateEnvironment({
      DATABASE_URL: "postgresql://db.example.test/app",
      APP_SECRET: "a".repeat(32),
      INTERNAL_API_SECRET: "i".repeat(32),
      PORT: "4310",
    }).API_PORT).toBe(4310);
  });

  it("uses a dedicated internal API secret without replacing APP_SECRET", () => {
    const result = validateEnvironment({
      DATABASE_URL: "postgresql://db.example.test/app",
      APP_SECRET: "a".repeat(32),
      INTERNAL_API_SECRET: "i".repeat(32),
      PORT: "4310",
    });

    expect(result.INTERNAL_API_SECRET).toBe("i".repeat(32));
    expect(result.APP_SECRET).toBe("a".repeat(32));
  });
});
