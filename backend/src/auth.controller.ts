import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Body, Controller, Get, Headers, Inject, Post, UseGuards } from "@nestjs/common";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { ApiStandardErrors } from "./common/api-errors.decorator.js";
import { InternalApiGuard } from "./internal-api.guard.js";
import { AuthService } from "./auth.service.js";

class CredentialsDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

class PasswordResetRequestDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

class PasswordResetDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

class EmailVerificationDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;
}

@ApiStandardErrors()
@ApiTags("auth")
@ApiSecurity("internal-api-token")
@Controller("v1/auth")
@UseGuards(InternalApiGuard)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("signup")
  signUp(@Body() body: CredentialsDto) {
    return this.auth.signUp(body.email, body.password);
  }

  @Post("login")
  signIn(@Body() body: CredentialsDto) {
    return this.auth.signIn(body.email, body.password);
  }

  @Post("email-verification")
  resendEmailVerification(@Body() body: PasswordResetRequestDto) {
    return this.auth.resendEmailVerification(body.email);
  }

  @Post("email-verification/confirm")
  confirmEmailVerification(@Body() body: EmailVerificationDto) {
    return this.auth.confirmEmailVerification(body.token);
  }

  @Post("password-reset")
  requestPasswordReset(@Body() body: PasswordResetRequestDto) {
    return this.auth.requestPasswordReset(body.email);
  }

  @Post("password-reset/confirm")
  resetPassword(@Body() body: PasswordResetDto) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @Get("session")
  async getSession(@Headers("authorization") authorization?: string) {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    return { user: await this.auth.getSession(token) };
  }

  @Post("logout")
  async signOut(@Headers("authorization") authorization?: string) {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    await this.auth.signOut(token);
    return { status: "signed_out" };
  }
}
