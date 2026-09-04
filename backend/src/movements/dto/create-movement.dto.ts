import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MovementType } from '@prisma/client';
import { IsValidMovementShape } from './movement-shape.validator';

/**
 * There is deliberately no `userId` field: `whitelist: true` strips one if a
 * caller sends it, and the service always stamps the authenticated actor, so a
 * movement can never be attributed to somebody else.
 */
export class CreateMovementDto {
  @IsValidMovementShape()
  @IsEnum(MovementType, { message: 'type must be one of IN, OUT, TRANSFER' })
  type!: MovementType;

  @IsString()
  @IsNotEmpty({ message: 'itemId is required' })
  @MaxLength(64)
  itemId!: string;

  /** Required for OUT and TRANSFER, forbidden for IN — see IsValidMovementShape. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  fromLocId?: string | null;

  /** Required for IN and TRANSFER, forbidden for OUT — see IsValidMovementShape. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  toLocId?: string | null;

  /** `transform: true` coerces the numeric string a form posts; @IsInt still
   *  rejects 1.5 and 'abc', and @Min(1) rejects 0 and negatives. */
  @Type(() => Number)
  @IsInt({ message: 'qty must be a whole number' })
  @Min(1, { message: 'qty must be at least 1' })
  qty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
