import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QueryFailedError } from 'typeorm';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordHasherService } from './password-hasher.service';

export interface PublicUserResponse {
  id: string;
  fullName: string;
  email: string;
}

export interface AuthenticationResponse {
  user: PublicUserResponse;
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterDto): Promise<AuthenticationResponse> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw this.emailConflict();
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    try {
      const user = await this.usersService.create({
        email,
        passwordHash,
        fullName: input.fullName.trim(),
      });
      return this.createAuthenticationResponse(user);
    } catch (error) {
      if (this.isEmailUniqueViolation(error)) {
        throw this.emailConflict();
      }
      throw error;
    }
  }

  async login(input: LoginDto): Promise<AuthenticationResponse> {
    const email = input.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Spend comparable bcrypt work for an unknown address to reduce enumeration timing.
      await this.passwordHasher.hash(input.password);
      throw this.invalidCredentials();
    }

    const passwordMatches = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw this.invalidCredentials();
    }

    return this.createAuthenticationResponse(user);
  }

  private async createAuthenticationResponse(
    user: User,
  ): Promise<AuthenticationResponse> {
    const publicUser: PublicUserResponse = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
    };
    const accessToken = await this.jwtService.signAsync(
      { email: user.email },
      { subject: user.id },
    );
    return { user: publicUser, accessToken };
  }

  private isEmailUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = (
      error as QueryFailedError & {
        driverError?: { code?: string; constraint?: string };
      }
    ).driverError;
    return (
      driverError?.code === '23505' &&
      driverError.constraint === 'users_email_normalized_uq'
    );
  }

  private emailConflict(): ConflictException {
    return new ConflictException({
      code: 'EMAIL_ALREADY_REGISTERED',
      message: 'An account with this email already exists.',
    });
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect.',
    });
  }
}
