import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Zone is required' })
  @MaxLength(64)
  zone!: string;
}
