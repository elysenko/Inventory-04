import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsEmailAddress } from '../../common/email';

/**
 * Note the absence of a `role` field: combined with `whitelist: true` on the
 * global ValidationPipe, a `role` sent in the body is stripped before it ever
 * reaches the service, which assigns `clerk` unconditionally.
 */
export class SignupDto {
  @IsEmailAddress()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;

  /** Display name from the signup form. Optional so an API client can omit it,
   *  but persisted when sent — the form asks for it, so it must not be dropped. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;
}
