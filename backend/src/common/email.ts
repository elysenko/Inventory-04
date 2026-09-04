import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';

/**
 * Deliberately looser than `@IsEmail`: the seeded demo identities are
 * `manager@demo` / `clerk@demo`, which have no TLD and which a strict RFC check
 * rejects outright — locking every reviewer out of the app. This is the same
 * shape the Angular AuthService validates against, so client and server agree
 * on what they accept.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

export function IsEmailAddress(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }): unknown =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    IsString({ message: 'A valid email address is required' }),
    MaxLength(255),
    Matches(EMAIL_PATTERN, { message: 'A valid email address is required' }),
  );
}
