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

@ApiStandardErrors()
@ApiTags("auth")
@ApiSecurity("internal-api-token")
@Controller("v1/auth")
@UseGuards(InternalApiGuard)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("signup")
  signUp(@Body() body: CredentialsDto, @Headers("x-client-address") clientAddress?: string) {
    return this.auth.signUp(body.email, body.password, clientAddress || "unknown");
  }

  @Post("login")
  signIn(@Body() body: CredentialsDto, @Headers("x-client-address") clientAddress?: string) {
    return this.auth.signIn(body.email, body.password, clientAddress || "unknown");
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
