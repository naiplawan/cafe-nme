import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  code?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const requestId = request.header("x-request-id") ?? "unknown";
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    let message: string | string[];
    if (status >= 500) {
      message = "Internal server error";
    } else if (typeof body === "string") {
      message = body;
    } else if (body && typeof body === "object" && "message" in body) {
      message = body.message as string | string[];
    } else if (exception instanceof Error) {
      const { message: exceptionMessage } = exception;
      message = exceptionMessage;
    } else {
      message = "Request failed";
    }
    const code = body && typeof body === "object" && "code" in body && typeof body.code === "string"
      ? body.code
      : undefined;

    if (status >= 500) {
      const error = exception instanceof Error ? exception : null;
      const stack = error?.stack?.split("\n").slice(1).join("\n");
      const causeName = error?.cause instanceof Error ? error.cause.name : undefined;
      this.logger.error(JSON.stringify({
        requestId,
        method: request.method,
        path: request.path,
        statusCode: status,
        errorName: error?.name ?? "UnknownError",
        ...(causeName ? { causeName } : {}),
        ...(stack ? { stack } : {}),
      }));
    }

    const errorBody: ErrorBody = {
      statusCode: status,
      message,
      error: status >= 500 ? "Internal Server Error" : "Request Error",
      ...(code ? { code } : {}),
    };
    response.status(status).json(errorBody);
  }
}
