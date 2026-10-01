import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SellerStatus } from '@prisma/client';
import {
  SELLER_PASSWORD_MESSAGE,
  SELLER_PASSWORD_PATTERN,
  SELLER_PHONE_MESSAGE,
  SELLER_PHONE_PATTERN,
  Trim,
} from './seller-fields';

export class UpdateSellerProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2, { message: 'Le prénom doit faire au moins 2 caractères' })
  @MaxLength(80, { message: 'Le prénom doit faire au plus 80 caractères' })
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2, { message: 'Le nom doit faire au moins 2 caractères' })
  @MaxLength(80, { message: 'Le nom doit faire au plus 80 caractères' })
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(SELLER_PHONE_PATTERN, { message: SELLER_PHONE_MESSAGE })
  phone?: string;
}

export class ChangeSellerPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Mot de passe actuel requis' })
  @MaxLength(72)
  currentPassword!: string;

  @ApiProperty({ description: '8 à 72 caractères, au moins une lettre et un chiffre' })
  @IsString()
  @Matches(SELLER_PASSWORD_PATTERN, { message: SELLER_PASSWORD_MESSAGE })
  newPassword!: string;
}

export class UpdateSellerStatusDto {
  @ApiProperty({ enum: SellerStatus })
  @IsEnum(SellerStatus, { message: 'Statut invalide' })
  status!: SellerStatus;
}
