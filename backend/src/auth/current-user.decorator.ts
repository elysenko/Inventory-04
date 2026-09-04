import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth-user';

/**
 * Injects the authenticated user attached by JwtStrategy. Movement writes stamp
 * `userId` from here rather than from the request body, so a caller cannot
 * attribute an audit row to somebody else.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    return request.user;
  },
);
