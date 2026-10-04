import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupportTopic } from '@prisma/client';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { EmptyToNull, NormalizeEmail, Trim } from '../../sellers/dto/seller-fields';

export class CreateSupportRequestDto {
  @ApiProperty({ enum: SupportTopic })
  @IsEnum(SupportTopic, { message: 'Choisissez le sujet de votre message' })
  topic!: SupportTopic;

  @ApiProperty({ example: 'Awa Ngono' })
  @Trim()
  @IsString()
  @MinLength(2, { message: 'Indiquez votre nom' })
  @MaxLength(100, { message: 'Le nom doit faire au plus 100 caractères' })
  name!: string;

  @ApiProperty({ example: 'awa@exemple.cm', description: 'Adresse à laquelle la réponse est envoyée' })
  @NormalizeEmail()
  @IsEmail({}, { message: "Indiquez une adresse e-mail valide : c'est là que nous vous répondrons" })
  @MaxLength(150)
  email!: string;

  @ApiPropertyOptional({ example: 'BS-2026-12345' })
  @IsOptional()
  @EmptyToNull()
  @Matches(/^BS-\d{4}-\d{5}$/i, { message: 'Numéro de commande invalide (ex. : BS-2026-12345)' })
  orderNumber?: string | null;

  @ApiProperty({ minLength: 10, maxLength: 3000 })
  @Trim()
  @IsString()
  @MinLength(10, { message: 'Décrivez votre demande en quelques mots (10 caractères au moins)' })
  @MaxLength(3000, { message: 'Le message doit faire au plus 3 000 caractères' })
  message!: string;

  /** Champ invisible pour les visiteurs : seuls les robots le remplissent. */
  @ApiPropertyOptional({ description: 'Laisser vide' })
  @IsOptional()
  @IsString()
  website?: string;
}

export class HandleSupportRequestDto {
  @ApiProperty({ enum: ['reply', 'close', 'reopen'] })
  @IsIn(['reply', 'close', 'reopen'], { message: 'Action invalide' })
  action!: 'reply' | 'close' | 'reopen';

  @ApiPropertyOptional({ description: 'Réponse envoyée par e-mail (action « reply »)' })
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(5, { message: 'La réponse doit faire au moins 5 caractères' })
  @MaxLength(5000, { message: 'La réponse doit faire au plus 5 000 caractères' })
  reply?: string;
}
