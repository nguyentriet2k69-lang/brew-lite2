import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import {
  CurrentUser,
  extractCurrentUser,
} from './current-user.decorator';

describe('CurrentUser decorator', () => {
  it('reads the authenticated user placed on the request by the guard', () => {
    const user = {
      userId: '00000000-0000-4000-8000-000000000001',
      email: 'user@example.com',
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;

    expect(extractCurrentUser(context)).toEqual(user);
  });

  it('is registered as a Nest parameter decorator without a test endpoint', () => {
    class DecoratorMetadataTarget {
      handler(_user: unknown): void {}
    }
    const decorator = CurrentUser();
    decorator(DecoratorMetadataTarget.prototype, 'handler', 0);

    expect(
      Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        DecoratorMetadataTarget,
        'handler',
      ),
    ).toBeDefined();
  });
});
