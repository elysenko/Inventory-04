/**
 * Single source of truth for the signing secret. Read once at module load so
 * JwtModule and JwtStrategy can never drift onto different values (which would
 * mint tokens that the strategy then rejects).
 */
export const JWT_SECRET: string =
  process.env.JWT_SECRET ?? 'stockroom-dev-secret-change-me';

/**
 * Typed as the `ms`-style string literal @nestjs/jwt expects. Env overrides are
 * accepted verbatim (e.g. `1d`, `24h`, `3600s`); the cast is safe because the
 * value only ever reaches jsonwebtoken's expiresIn parser.
 */
export const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ??
  process.env.JWT_EXPIRATION ??
  '24h') as `${number}${'s' | 'm' | 'h' | 'd'}`;
