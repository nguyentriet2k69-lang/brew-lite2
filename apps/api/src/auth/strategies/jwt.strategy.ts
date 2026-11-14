import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

interface AccessTokenPayload {
  sub?: unknown;
  email?: unknown;
}

@Injectable()
export class JwtStrategy {
  constructor(private readonly jwtService: JwtService) {}

  async authenticate(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        { algorithms: ['HS256'] },
      );
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string'
      ) {
        throw new Error('Required token claims are missing.');
      }
      return { userId: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'A valid bearer token is required.',
      });
    }
  }
}
