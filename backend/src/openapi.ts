import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import type { INestApplication } from "@nestjs/common";

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("YELO Coffee Backend API")
    .setDescription("Internal API used by the YELO Coffee frontend server.")
    .setVersion("1.0")
    .addApiKey({ type: "apiKey", in: "header", name: "x-internal-api-token" }, "internal-api-token")
    .build();
  return SwaggerModule.createDocument(app, config);
}
