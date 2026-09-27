import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  // bcrypt ignore tout ce qui dépasse 72 octets.
  @ApiProperty({ description: '12 à 72 caractères' })
  @IsString()
  @MinLength(12, { message: 'Le nouveau mot de passe doit faire au moins 12 caractères' })
  @MaxLength(72, { message: 'Le nouveau mot de passe doit faire au plus 72 caractères' })
  newPassword!: string;
}
