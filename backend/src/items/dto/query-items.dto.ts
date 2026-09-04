import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Parses `true`/`1`/`yes` (any casing) as true and everything else as false,
 *  so `?lowStock=notabool` degrades to "off" instead of throwing a 500. */
function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

export class QueryItemsDto {
  /** Case-insensitive substring match against both `name` and `sku`. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Transform(({ value }): unknown => toBoolean(value))
  @IsBoolean()
  lowStock?: boolean;
}
