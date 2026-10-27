import { Body, Controller, Headers, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiProperty, ApiPropertyOptional, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiErrorDto } from './common/api-error.dto.js';
import { ApiStandardErrors } from './common/api-errors.decorator.js';
import { ContactService } from './contact.service.js';
import { InternalApiGuard } from './internal-api.guard.js';

const phonePattern = /^[0-9+\- ]{9,20}$/;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class ContactMessageDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(100)
  name!: string;

  @ApiProperty({ format: 'email', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ pattern: '^[0-9+\\- ]{9,20}$' })
  @Transform(trim) @IsOptional() @IsString() @Matches(phonePattern)
  phone?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(trim) @IsOptional() @IsString() @MaxLength(120)
  shopName?: string;

  @ApiProperty({ enum: ['demo', 'pricing', 'support', 'other'] })
  @Transform(trim) @IsIn(['demo', 'pricing', 'support', 'other'])
  topic!: 'demo' | 'pricing' | 'support' | 'other';

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(2000)
  message!: string;

  @ApiProperty({ enum: [true] })
  @IsBoolean() @Equals(true)
  consent!: boolean;
}

class ContactResultDto {
  @ApiProperty({ enum: ['received'] }) status!: 'received';
}

@ApiStandardErrors()
@ApiTags('contact')
@ApiSecurity('internal-api-token')
@UseGuards(InternalApiGuard)
@Controller('v1/contact-messages')
export class ContactController {
  constructor(@Inject(ContactService) private readonly contact: ContactService) {}

  @Post()
  @ApiCreatedResponse({ type: ContactResultDto })
  @ApiResponse({ status: 429, description: 'Contact rate limit exceeded', type: ApiErrorDto })
  create(@Body() body: ContactMessageDto, @Headers('x-client-address') address?: string) {
    return this.contact.receive(body, address || 'unknown');
  }
}
