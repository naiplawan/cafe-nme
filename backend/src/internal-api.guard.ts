import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

@Injectable()
export class InternalApiGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.getOrThrow<string>("APP_SECRET");
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header("x-internal-api-token");

    if (!provided) {
      throw new UnauthorizedException();
    }
    const expected = createHmac("sha256", secret).update("cafe-pos:internal-api-v1").digest("hex");
    const expectedBytes = Buffer.from(expected);
    const providedBytes = Buffer.from(provided);
    if (expectedBytes.length !== providedBytes.length || !timingSafeEqual(expectedBytes, providedBytes)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
