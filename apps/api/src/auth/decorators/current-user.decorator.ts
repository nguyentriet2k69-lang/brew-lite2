import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

export function extractCurrentUser(
  context: ExecutionContext,
): AuthenticatedUser | undefined {
  return context
    .switchToHttp()
    .getRequest<{ user?: AuthenticatedUser }>().user;
}

export const CurrentUser = createParamDecorator((_data, context) =>
  extractCurrentUser(context),
);
