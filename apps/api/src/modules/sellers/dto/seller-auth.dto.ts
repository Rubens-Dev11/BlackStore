import { IsEmail, IsHexadecimal, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  NormalizeEmail,
  SELLER_PASSWORD_MESSAGE,
  SELLER_PASSWORD_PATTERN,
  SELLER_PHONE_MESSAGE,
  SELLER_PHONE_PATTERN,
  Trim,
} from './seller-fields';

export class RegisterSellerDto {
  @ApiProperty({ example: 'Awa' })
  @Trim()
  @IsString()
  @MinLength(2, { message: 'Le prénom doit faire au moins 2 caractères' })
  @MaxLength(80, { message: 'Le prénom doit faire au plus 80 caractères' })
  firstName!: string;

  @ApiProperty({ example: 'Ngono' })
  @Trim()
  @IsString()
  @MinLength(2, { message: 'Le nom doit faire au moins 2 caractères' })
  @MaxLength(80, { message: 'Le nom doit faire au plus 80 caractères' })
  lastName!: string;

  @ApiProperty({ example: 'awa@exemple.cm' })
  @NormalizeEmail()
  @IsEmail({}, { message: "L'e-mail doit être valide" })
  @MaxLength(150)
  email!: string;

  @ApiProperty({ example: '+237 6 99 00 00 00' })
  @IsString()
  @Matches(SELLER_PHONE_PATTERN, { message: SELLER_PHONE_MESSAGE })
  phone!: string;

  @ApiProperty({ description: '8 à 72 caractères, au moins une lettre et un chiffre' })
  @IsString()
  @Matches(SELLER_PASSWORD_PATTERN, { message: SELLER_PASSWORD_MESSAGE })
  password!: string;
}

export class LoginSellerDto {
  @ApiProperty({ example: 'awa@exemple.cm' })
  @NormalizeEmail()
  @IsEmail({}, { message: "L'e-mail doit être valide" })
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Mot de passe requis' })
  @MaxLength(72)
  password!: string;
}

export class SellerEmailDto {
  @ApiProperty({ example: 'awa@exemple.cm' })
  @NormalizeEmail()
  @IsEmail({}, { message: "L'e-mail doit être valide" })
  email!: string;
}

/** Lien reçu par e-mail : 32 octets aléatoires en hexadécimal. */
export class SellerTokenDto {
  @ApiProperty()
  @IsHexadecimal({ message: 'Lien invalide ou expiré' })
  @Length(64, 64, { message: 'Lien invalide ou expiré' })
  token!: string;
}

export class ResetSellerPasswordDto extends SellerTokenDto {
  @ApiProperty({ description: '8 à 72 caractères, au moins une lettre et un chiffre' })
  @IsString()
  @Matches(SELLER_PASSWORD_PATTERN, { message: SELLER_PASSWORD_MESSAGE })
  newPassword!: string;
}
