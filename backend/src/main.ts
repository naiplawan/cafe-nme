import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { AppModule } from "./app.module.js";
import { HttpExceptionFilter } from "./http-exception.filter.js";
import { createOpenApiDocument } from "./openapi.js";

const helmetMiddleware = createRequire(import.meta.url)("helmet") as () => RequestHandler;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger("Bootstrap");
  app.use(helmetMiddleware());
  // This API is called server-to-server by the frontend; browser CORS stays disabled.
  const requestIdMiddleware: RequestHandler = (request, response, next) => {
    const requestId = randomUUID();
    request.headers["x-request-id"] = requestId;
    response.setHeader("x-request-id", requestId);
    next();
  };
  app.use(requestIdMiddleware);
  // biome-ignore lint/correctness/useHookAtTopLevel: Nest application registration method, not a React hook.
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  // biome-ignore lint/correctness/useHookAtTopLevel: Nest application registration method, not a React hook.
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  if (config.get<string>("NODE_ENV") === "development") {
    SwaggerModule.setup("docs", app, createOpenApiDocument(app));
  }

  const port = config.getOrThrow<number>("API_PORT");
  await app.listen(port, "0.0.0.0");
  logger.log(`API listening on port ${port}`);
}

void bootstrap();
