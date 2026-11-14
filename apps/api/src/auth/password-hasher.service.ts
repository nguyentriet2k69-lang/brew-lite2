import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Cost 12 balances password-guessing resistance with interactive MVP login latency.
export const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class PasswordHasherService {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  compare(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
