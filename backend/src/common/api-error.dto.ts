import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ApiErrorDto {
  @ApiProperty({ type: Number }) statusCode!: number;
  @ApiProperty({
    type: () => String,
    oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
  })
  message!: string | string[];
  @ApiProperty({ type: String }) error!: string;
  @ApiPropertyOptional({ type: String }) code?: string;
}
