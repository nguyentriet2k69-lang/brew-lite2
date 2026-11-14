import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from '../strategies/jwt.strategy';

const TEST_JWT_SECRET = 'phase-three-test-only-secret-0123456789abcdef';
const testUser = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'user@example.com',
};

describe('JWT authentication guard and strategy', () => {
  let guard: JwtAuthGuard;
  let signingJwt: JwtService;
  let request: { headers: { authorization?: string }; user?: unknown };
  let context: ExecutionContext;

  beforeEach(() => {
    const verifyingJwt = new JwtService({ secret: TEST_JWT_SECRET });
    signingJwt = new JwtService({ secret: TEST_JWT_SECRET });
    guard = new JwtAuthGuard(new JwtStrategy(verifyingJwt));
    request = { headers: {} };
    context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  });

  it('accepts a valid signed bearer token and attaches only safe claims', async () => {
    const token = await signingJwt.signAsync(
      { email: testUser.email },
      { subject: testUser.userId },
    );
    request.headers.authorization = `Bearer ${token}`;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(testUser);
  });

  it('rejects a token with an invalid signature', async () => {
    const token = await new JwtService({
      secret: 'different-test-only-secret-0123456789abcdef',
    }).signAsync({ email: testUser.email }, { subject: testUser.userId });
    request.headers.authorization = `Bearer ${token}`;

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'INVALID_ACCESS_TOKEN' },
    });
  });

  it('rejects expired tokens', async () => {
    const token = await signingJwt.signAsync(
      { email: testUser.email },
      { subject: testUser.userId, expiresIn: '-1s' },
    );
    request.headers.authorization = `Bearer ${token}`;

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'INVALID_ACCESS_TOKEN' },
    });
  });

  it.each([undefined, 'Basic abc.def', 'Bearer', 'Bearer token extra'])(
    'rejects missing or malformed bearer credentials (%s)',
    async (authorization) => {
      request.headers.authorization = authorization;
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { code: 'INVALID_ACCESS_TOKEN' },
      });
    },
  );
});
