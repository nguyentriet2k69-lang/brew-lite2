import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QueryFailedError } from 'typeorm';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordHasherService } from './password-hasher.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<Pick<UsersService, 'findByEmail' | 'create'>>;
  let passwords: jest.Mocked<Pick<PasswordHasherService, 'hash' | 'compare'>>;
  let jwt: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  const user = {
    id: '00000000-0000-4000-8000-000000000001',
    fullName: 'Nguyen Van A',
    email: 'user@example.com',
    passwordHash: '$2b$12$hash-not-a-real-password',
  } as User;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    passwords = {
      hash: jest.fn(),
      compare: jest.fn(),
    };
    jwt = { signAsync: jest.fn() };
    service = new AuthService(
      users as unknown as UsersService,
      passwords as unknown as PasswordHasherService,
      jwt as unknown as JwtService,
    );
  });

  it('normalizes email, hashes the password, and returns only public user fields', async () => {
    users.findByEmail.mockResolvedValue(null);
    passwords.hash.mockResolvedValue('$2b$12$hashed-value');
    users.create.mockResolvedValue({
      id: user.id,
      fullName: 'Nguyen Van A',
      email: 'user@example.com',
      passwordHash: '$2b$12$hashed-value',
    } as User);
    jwt.signAsync.mockResolvedValue('signed-access-token');

    const response = await service.register({
      fullName: ' Nguyen Van A ',
      email: ' User@Example.COM ',
      password: 'a-long-test-password',
    } as RegisterDto);

    expect(users.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(passwords.hash).toHaveBeenCalledWith('a-long-test-password');
    expect(users.create).toHaveBeenCalledWith({
      email: 'user@example.com',
      fullName: 'Nguyen Van A',
      passwordHash: '$2b$12$hashed-value',
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { email: 'user@example.com' },
      { subject: user.id },
    );
    expect(response).toEqual({
      user: { id: user.id, fullName: 'Nguyen Van A', email: 'user@example.com' },
      accessToken: 'signed-access-token',
    });
    expect(JSON.stringify(response)).not.toContain('passwordHash');
    expect(JSON.stringify(response)).not.toContain('a-long-test-password');
  });

  it('rejects an existing email without hashing or creating another account', async () => {
    users.findByEmail.mockResolvedValue(user);

    await expect(
      service.register({
        fullName: 'Nguyen Van A',
        email: 'USER@example.com',
        password: 'a-long-test-password',
      } as RegisterDto),
    ).rejects.toMatchObject({
      response: { code: 'EMAIL_ALREADY_REGISTERED' },
    });
    expect(passwords.hash).not.toHaveBeenCalled();
    expect(users.create).not.toHaveBeenCalled();
  });

  it('maps a concurrent normalized-email unique-index violation to HTTP 409', async () => {
    users.findByEmail.mockResolvedValue(null);
    passwords.hash.mockResolvedValue('$2b$12$hashed-value');
    users.create.mockRejectedValue(
      new QueryFailedError('INSERT INTO users', [], {
        code: '23505',
        constraint: 'users_email_normalized_uq',
      }),
    );

    await expect(
      service.register({
        fullName: 'Nguyen Van A',
        email: 'user@example.com',
        password: 'a-long-test-password',
      } as RegisterDto),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with normalized email, bcrypt comparison, and the same response shape', async () => {
    users.findByEmail.mockResolvedValue(user);
    passwords.compare.mockResolvedValue(true);
    jwt.signAsync.mockResolvedValue('signed-access-token');

    const response = await service.login({
      email: ' USER@Example.COM ',
      password: 'a-long-test-password',
    } as LoginDto);

    expect(users.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(passwords.compare).toHaveBeenCalledWith(
      'a-long-test-password',
      user.passwordHash,
    );
    expect(response).toEqual({
      user: { id: user.id, fullName: user.fullName, email: user.email },
      accessToken: 'signed-access-token',
    });
    expect(JSON.stringify(response)).not.toContain('passwordHash');
  });

  it('uses one generic 401 response for unknown email and wrong password', async () => {
    users.findByEmail.mockResolvedValue(null);
    passwords.hash.mockResolvedValue('$2b$12$discarded-test-hash');

    const unknownEmail = service.login({
      email: 'unknown@example.com',
      password: 'a-long-test-password',
    } as LoginDto);
    await expect(unknownEmail).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(unknownEmail).rejects.toMatchObject({
      response: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      },
    });
    expect(passwords.hash).toHaveBeenCalledWith('a-long-test-password');

    users.findByEmail.mockResolvedValue(user);
    passwords.compare.mockResolvedValue(false);
    await expect(
      service.login({
        email: 'user@example.com',
        password: 'wrong-test-password',
      } as LoginDto),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      },
    });
  });
});
