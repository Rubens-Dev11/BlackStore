import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@blackstore.cm' })
  @IsEmail({}, { message: 'L\'email doit être valide' })
  email!: string;

  @ApiProperty({ example: 'Admin@BlackStore2026!' })
  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit faire au moins 6 caractères' })
  password!: string;
}
