import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeReason, MobileMoneyOperator } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { EmptyToNull, NormalizeEmail, Trim } from '../../sellers/dto/seller-fields';

/** Commande retrouvée par son numéro et l'e-mail de l'acheteur (comme sur la page de commande). */
export class FindDisputableOrderDto {
  @ApiProperty({ example: 'BS-2026-12345' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^BS-\d{4}-\d{5}$/, { message: 'Numéro de commande invalide (ex. : BS-2026-12345)' })
  orderNumber!: string;

  @ApiProperty({ example: 'awa@exemple.cm', description: 'Adresse e-mail utilisée pour la commande' })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Indiquez l’adresse e-mail utilisée pour la commande' })
  @MaxLength(150)
  email!: string;
}

export class CreateDisputeDto extends FindDisputableOrderDto {
  @ApiProperty({ description: 'Article de la commande concerné' })
  @IsUUID('all', { message: 'Choisissez le produit concerné' })
  orderItemId!: string;

  @ApiProperty({ enum: DisputeReason })
  @IsEnum(DisputeReason, { message: 'Choisissez le motif de la demande' })
  reason!: DisputeReason;

  @ApiProperty({ minLength: 20, maxLength: 3000 })
  @Trim()
  @IsString()
  @MinLength(20, { message: 'Décrivez le problème en quelques phrases (20 caractères au moins)' })
  @MaxLength(3000, { message: 'La description doit faire au plus 3 000 caractères' })
  description!: string;

  @ApiProperty({ enum: MobileMoneyOperator, description: 'Compte qui recevra le remboursement' })
  @IsEnum(MobileMoneyOperator, { message: 'Choisissez Orange Money ou MTN Mobile Money pour le remboursement' })
  refundOperator!: MobileMoneyOperator;

  @ApiProperty({ example: '6 99 00 00 00' })
  @Trim()
  @IsString()
  @MinLength(8, { message: 'Numéro Mobile Money invalide' })
  @MaxLength(20, { message: 'Numéro Mobile Money invalide' })
  refundPhone!: string;

  @ApiProperty({ description: 'Nom du titulaire du compte Mobile Money' })
  @Trim()
  @IsString()
  @MinLength(3, { message: 'Indiquez le nom du titulaire du compte Mobile Money' })
  @MaxLength(160, { message: 'Le nom du titulaire doit faire au plus 160 caractères' })
  refundAccountName!: string;

  /** Champ invisible pour les visiteurs : seuls les robots le remplissent. */
  @ApiPropertyOptional({ description: 'Laisser vide' })
  @IsOptional()
  @IsString()
  website?: string;
}

export class RespondDisputeDto {
  @ApiProperty({ minLength: 10, maxLength: 3000, description: 'Réponse du vendeur, transmise à l’administrateur' })
  @Trim()
  @IsString()
  @MinLength(10, { message: 'Expliquez votre position en quelques mots (10 caractères au moins)' })
  @MaxLength(3000, { message: 'La réponse doit faire au plus 3 000 caractères' })
  message!: string;

  @ApiProperty({ description: 'Le vendeur accepte que l’acheteur soit remboursé' })
  // Seul un vrai booléen « true » vaut accord (la conversion automatique ferait de « false » un vrai).
  @Transform(({ obj }) => obj.acceptRefund === true)
  @IsBoolean()
  acceptRefund!: boolean;
}

export class HandleDisputeDto {
  @ApiProperty({ enum: ['accept', 'reject', 'refunded'] })
  @IsIn(['accept', 'reject', 'refunded'], { message: 'Action invalide' })
  action!: 'accept' | 'reject' | 'refunded';

  @ApiPropertyOptional({ description: 'Motif du refus (obligatoire) ou message joint à l’acceptation, envoyé au client' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(1000, { message: 'Le message doit faire au plus 1 000 caractères' })
  note?: string | null;

  @ApiPropertyOptional({ description: 'Référence de l’envoi Mobile Money (action « refunded »)' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(100, { message: 'La référence doit faire au plus 100 caractères' })
  reference?: string | null;
}

export type DisputeListFilter = 'todo' | 'waiting' | 'closed';
