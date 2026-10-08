import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** Fin du changement obligatoire : code reçu par e-mail + nouveau mot de passe. */
export class ConfirmPasswordChangeDto {
  @ApiProperty({ description: 'Jeton renvoyé par POST /auth/login' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{20,100}$/, { message: 'Demande de changement invalide : reconnectez-vous.' })
  challenge!: string;

  @ApiProperty({ description: 'Code à 6 chiffres reçu par e-mail' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Le code reçu par e-mail compte 6 chiffres' })
  code!: string;

  // bcrypt ignore tout ce qui dépasse 72 octets.
  @ApiProperty({ description: '12 à 72 caractères' })
  @IsString()
  @MinLength(12, { message: 'Le nouveau mot de passe doit faire au moins 12 caractères' })
  @MaxLength(72, { message: 'Le nouveau mot de passe doit faire au plus 72 caractères' })
  newPassword!: string;
}
