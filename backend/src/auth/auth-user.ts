import type { Role } from '@prisma/client';

/**
 * The request-scoped identity produced by JwtStrategy.validate(). It is a
 * projection of the User row — `passwordHash` is deliberately never included so
 * it cannot leak through `GET /api/auth/me` or an accidental echo.
 */
export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  createdAt?: Date;
}

/** Shape of the signed JWT payload. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
