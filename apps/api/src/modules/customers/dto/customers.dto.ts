import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../sellers/dto/seller-fields';

export class RequestLoginLinkDto {
  @ApiProperty({ example: 'awa@exemple.cm', description: 'Adresse e-mail utilisée pour les achats' })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Indiquez l’adresse e-mail utilisée pour vos achats' })
  @MaxLength(150)
  email!: string;
}

export class OpenSessionDto {
  @ApiProperty({ description: 'Jeton du lien de connexion reçu par e-mail' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{20,100}$/, { message: 'Lien de connexion invalide : ouvrez le lien reçu par e-mail.' })
  jeton!: string;
}
