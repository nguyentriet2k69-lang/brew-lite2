import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

describe('Authentication DTO validation', () => {
  it('trims the name and normalizes email for registration and login', async () => {
    const register = plainToInstance(RegisterDto, {
      fullName: ' Nguyen Van A ',
      email: ' User@Example.COM ',
      password: 'a-long-test-password',
    });
    const login = plainToInstance(LoginDto, {
      email: ' User@Example.COM ',
      password: 'a-long-test-password',
    });

    expect(register.fullName).toBe('Nguyen Van A');
    expect(register.email).toBe('user@example.com');
    expect(login.email).toBe('user@example.com');
    await expect(validate(register)).resolves.toHaveLength(0);
    await expect(validate(login)).resolves.toHaveLength(0);
  });

  it('rejects empty and malformed email inputs', async () => {
    const invalidInputs = [
      { fullName: 'Name', email: '', password: 'password123' },
      { fullName: 'Name', email: 'not-an-email', password: 'password123' },
    ];

    for (const input of invalidInputs) {
      await expect(
        validate(plainToInstance(RegisterDto, input)),
      ).resolves.not.toHaveLength(0);
    }
  });

  it('enforces the MVP password minimum and bcrypt UTF-8 byte limit', async () => {
    const tooShort = plainToInstance(RegisterDto, {
      fullName: 'Name',
      email: 'user@example.com',
      password: 'short7',
    });
    const tooManyBytes = plainToInstance(RegisterDto, {
      fullName: 'Name',
      email: 'user@example.com',
      password: '😀'.repeat(19),
    });
    const tooManyLoginBytes = plainToInstance(LoginDto, {
      email: 'user@example.com',
      password: '😀'.repeat(19),
    });

    await expect(validate(tooShort)).resolves.not.toHaveLength(0);
    await expect(validate(tooManyBytes)).resolves.not.toHaveLength(0);
    await expect(validate(tooManyLoginBytes)).resolves.not.toHaveLength(0);
  });
});
