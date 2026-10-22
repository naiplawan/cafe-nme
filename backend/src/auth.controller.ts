import { ApiProperty, ApiCreatedResponse, ApiOkResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Body, Controller, Get, Headers, Inject, Post, UseGuards } from "@nestjs/common";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { InternalApiGuard } from "./internal-api.guard.js";
import { PasswordRecoveryService } from "./password-recovery.service.js";
import { AuthService } from "./auth.service.js";
import { AuthSessionDto, AuthTokenDto, SignedOutDto } from "./core-response.dto.js";

class CredentialsDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

class RecoveryRequestDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
}
class RecoveryConfirmDto {
  @ApiProperty() @IsString() @MinLength(43) @MaxLength(43) token!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
class RecoveryResultDto {
  @ApiProperty({ enum: ['accepted', 'password_reset'] }) status!: string;
}

@ApiStandardErrors()
@ApiTags("auth")
@ApiSecurity("internal-api-token")
@Controller("v1/auth")
@UseGuards(InternalApiGuard)
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PasswordRecoveryService) private readonly recovery: PasswordRecoveryService,
  ) {}

  @Post("password-reset/request")
  @ApiCreatedResponse({ type: RecoveryResultDto })
  requestReset(@Body() body: RecoveryRequestDto, @Headers("x-client-address") address?: string) {
    return this.recovery.request(body.email, address || "unknown");
  }

  @Post("password-reset/confirm")
  @ApiCreatedResponse({ type: RecoveryResultDto })
  confirmReset(@Body() body: RecoveryConfirmDto, @Headers("x-client-address") address?: string) {
    return this.recovery.confirm(body.token, body.password, address || "unknown");
  }

  @Post("signup")
  @ApiCreatedResponse({ type: AuthTokenDto })
  signUp(@Body() body: CredentialsDto, @Headers("x-client-address") clientAddress?: string) {
    return this.auth.signUp(body.email, body.password, clientAddress || "unknown");
  }

  @Post("login")
  @ApiCreatedResponse({ type: AuthTokenDto })
  signIn(@Body() body: CredentialsDto, @Headers("x-client-address") clientAddress?: string) {
    return this.auth.signIn(body.email, body.password, clientAddress || "unknown");
  }

  @Get("session")
  @ApiOkResponse({ type: AuthSessionDto })
  async getSession(@Headers("authorization") authorization?: string) {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    return { user: await this.auth.getSession(token) };
  }

  @Post("logout")
  @ApiCreatedResponse({ type: SignedOutDto })
  async signOut(@Headers("authorization") authorization?: string) {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    await this.auth.signOut(token);
    return { status: "signed_out" };
  }
}
