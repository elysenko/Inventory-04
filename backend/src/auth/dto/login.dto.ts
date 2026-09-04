import { IsString, MinLength } from 'class-validator';
import { IsEmailAddress } from '../../common/email';

export class LoginDto {
  @IsEmailAddress()
  email!: string;

  @IsString({ message: 'Password is required' })
  @MinLength(1, { message: 'Password is required' })
  password!: string;
}
