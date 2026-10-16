import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { BrandAccentDto } from "./common/request.dto.js";
import { BrandService } from "./brand.service.js";
import { InternalApiGuard } from "./internal-api.guard.js";

const MAX_BASE64_BYTES = Math.ceil((300 * 1024) / 3) * 4;

async function readBoundedBase64(request: Request): Promise<string> {
  const contentType = request.header("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "text/plain") {
    throw new BadRequestException("Logo body must be base64 text");
  }
  const contentLength = request.header("content-length");
  if (contentLength && Number(contentLength) > MAX_BASE64_BYTES) {
    request.resume();
    throw new BadRequestException("ไฟล์โลโก้ใหญ่เกิน 300 KB");
  }

  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    length += bytes.byteLength;
    if (length > MAX_BASE64_BYTES || bytes.some((byte) => byte > 0x7f)) {
      request.resume();
      throw new BadRequestException("ไฟล์โลโก้ใหญ่เกิน 300 KB");
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, length).toString("ascii");
}

@ApiStandardErrors()
@ApiTags("brand")
@ApiSecurity("internal-api-token")
@Controller("v1/shops/:shopId/brand")
@UseGuards(InternalApiGuard)
export class BrandController {
  constructor(@Inject(BrandService) private readonly brand: BrandService) {}

  @Get()
  getBrand(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    return this.brand.getBrand(shopId);
  }

  @Get("logo")
  async getLogo(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Res() response: Response,
  ) {
    const logo = await this.brand.getLogo(shopId);
    if (!logo) {
      throw new NotFoundException("Brand logo not found");
    }
    response
      .status(200)
      .set({
        "Content-Type": logo.mime,
        "Content-Length": String(logo.bytes.byteLength),
        "X-Brand-Updated-At": logo.updatedAt.toISOString(),
        "X-Content-Type-Options": "nosniff",
      })
      .end(logo.bytes);
  }

  @Put("accent")
  async saveAccent(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Body() body: BrandAccentDto,
  ) {
    await this.brand.saveAccent(shopId, body.accent);
    return { success: true };
  }

  @Put("logo")
  async saveLogo(
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Req() request: Request,
  ) {
    const encoded = await readBoundedBase64(request);
    await this.brand.saveLogo(shopId, encoded);
    return { success: true };
  }

  @Delete("logo")
  async removeLogo(@Param("shopId", new ParseUUIDPipe()) shopId: string) {
    await this.brand.removeLogo(shopId);
    return { success: true };
  }
}
