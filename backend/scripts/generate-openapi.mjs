import { writeFile } from "node:fs/promises";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../dist/app.module.js";
import { createOpenApiDocument } from "../dist/openapi.js";

const app = await NestFactory.create(AppModule, { logger: false });
try {
  const document = createOpenApiDocument(app);
  await writeFile(new URL("../openapi.json", import.meta.url), `${JSON.stringify(document, null, 2)}\n`);
} finally {
  await app.close();
}
