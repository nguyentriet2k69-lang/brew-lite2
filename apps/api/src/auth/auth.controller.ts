import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { AuthService, AuthenticationResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

class AuthenticatedUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ format: 'email' })
  email: string;
}

class AuthenticationResponseDto implements AuthenticationResponse {
  @ApiProperty({ type: AuthenticatedUserDto })
  user: AuthenticatedUserDto;

  @ApiProperty({ description: 'Short-lived bearer access token' })
  accessToken: string;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a user and issue an access token' })
  @ApiCreatedResponse({ type: AuthenticationResponseDto })
  @ApiBadRequestResponse({ description: 'The request failed validation.' })
  @ApiConflictResponse({ description: 'The email is already registered.' })
  register(@Body() input: RegisterDto): Promise<AuthenticationResponse> {
    return this.authService.register(input);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and issue an access token' })
  @ApiOkResponse({ type: AuthenticationResponseDto })
  @ApiBadRequestResponse({ description: 'The request failed validation.' })
  @ApiUnauthorizedResponse({ description: 'Email or password is incorrect.' })
  login(@Body() input: LoginDto): Promise<AuthenticationResponse> {
    return this.authService.login(input);
  }
}
