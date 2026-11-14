import {
  BadRequestException,
  ConflictException,
  INestApplication,
  UnauthorizedException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController HTTP contract', () => {
  let app: INestApplication;
  let register: jest.Mock;
  let login: jest.Mock;

  const response = {
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      fullName: 'Nguyen Van A',
      email: 'user@example.com',
    },
    accessToken: 'test-signed-token',
  };

  beforeAll(async () => {
    register = jest.fn();
    login = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { register, login } },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors: ValidationError[]) =>
          new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed.',
            details: errors.map((error) => ({
              property: error.property,
              constraints: Object.values(error.constraints ?? {}),
            })),
          }),
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    register.mockReset().mockResolvedValue(response);
    login.mockReset().mockResolvedValue(response);
  });

  it('POST /auth/register returns HTTP 201 and the shared public response shape', async () => {
    const result = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Nguyen Van A',
        email: 'user@example.com',
        password: 'a-long-test-password',
      })
      .expect(201);

    expect(result.body).toEqual(response);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com' }),
    );
  });

  it('POST /auth/login returns HTTP 200 with the same response shape', async () => {
    const result = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'a-long-test-password' })
      .expect(200);

    expect(result.body).toEqual(response);
  });

  it('rejects invalid register input and disallows extra properties', async () => {
    const result = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: ' ',
        email: 'not-an-email',
        password: 'short',
        passwordHash: 'forbidden',
      })
      .expect(400);

    expect(result.body.code).toBe('VALIDATION_ERROR');
    expect(register).not.toHaveBeenCalled();
  });

  it('maps duplicate email and bad credentials to the documented statuses', async () => {
    register.mockRejectedValue(
      new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account with this email already exists.',
      }),
    );
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Nguyen Van A',
        email: 'user@example.com',
        password: 'a-long-test-password',
      })
      .expect(409);

    login.mockRejectedValue(
      new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      }),
    );
    const result = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'a-long-test-password' })
      .expect(401);
    expect(result.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});
