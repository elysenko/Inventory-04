import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateItemDto {
  @IsString()
  @IsNotEmpty({ message: 'SKU is required' })
  @MaxLength(64)
  sku!: string;

  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsNotEmpty({ message: 'Unit is required' })
  @MaxLength(32)
  unit!: string;

  /** `transform: true` plus @Type coerces the numeric string a form posts;
   *  @IsInt still rejects 'ten' and 1.5, and @Min(0) rejects negatives. */
  @Type(() => Number)
  @IsInt({ message: 'reorderAt must be an integer' })
  @Min(0, { message: 'reorderAt cannot be negative' })
  reorderAt!: number;
}
