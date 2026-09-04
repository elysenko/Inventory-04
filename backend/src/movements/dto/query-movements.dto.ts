import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MovementType } from '@prisma/client';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Treats `?itemId=` (empty string, as an unset Angular select emits) as absent
 *  rather than as a filter for the empty id, which would match nothing. */
const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  value === '' || value === null ? undefined : value;

export class QueryMovementsDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(64)
  itemId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(MovementType, { message: 'type must be one of IN, OUT, TRANSFER' })
  type?: MovementType;

  /** Inclusive lower bound on `createdAt`. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString({}, { message: 'from must be an ISO date string' })
  from?: string;

  /** Inclusive upper bound on `createdAt`. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString({}, { message: 'to must be an ISO date string' })
  to?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt({ message: 'page must be a whole number' })
  @Min(1, { message: 'page must be 1 or greater' })
  page?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
