import { applyDecorators } from "@nestjs/common";
import { ApiExtraModels, ApiResponse } from "@nestjs/swagger";
import { ApiErrorDto } from "./api-error.dto.js";

export function ApiStandardErrors() {
  return applyDecorators(
    ApiExtraModels(ApiErrorDto),
    ApiResponse({ status: 400, description: "Invalid request", type: ApiErrorDto }),
    ApiResponse({ status: 401, description: "Unauthorized", type: ApiErrorDto }),
    ApiResponse({ status: 403, description: "Forbidden", type: ApiErrorDto }),
    ApiResponse({ status: 404, description: "Resource not found", type: ApiErrorDto }),
    ApiResponse({ status: 409, description: "Conflict", type: ApiErrorDto }),
    ApiResponse({ status: 500, description: "Unexpected server error", type: ApiErrorDto }),
    ApiResponse({ status: 503, description: "Dependency unavailable", type: ApiErrorDto }),
  );
}
