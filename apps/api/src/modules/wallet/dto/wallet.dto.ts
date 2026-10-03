import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MobileMoneyOperator } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { EmptyToNull, Trim } from '../../sellers/dto/seller-fields';

export class RequestWithdrawalDto {
  @ApiProperty({ example: 10000, description: 'Montant en FCFA, multiple de 5' })
  @IsInt({ message: 'Le montant doit être un nombre entier de FCFA' })
  @Min(1, { message: 'Indiquez un montant' })
  amount!: number;

  @ApiProperty({ enum: MobileMoneyOperator })
  @IsEnum(MobileMoneyOperator, { message: 'Choisissez Orange Money ou MTN Mobile Money' })
  operator!: MobileMoneyOperator;

  @ApiProperty({ example: '6 99 00 00 00' })
  @Trim()
  @IsString()
  @MinLength(8, { message: 'Numéro Mobile Money invalide' })
  @MaxLength(20, { message: 'Numéro Mobile Money invalide' })
  phone!: string;

  @ApiProperty({ description: 'Nom du titulaire du compte Mobile Money' })
  @Trim()
  @IsString()
  @MinLength(3, { message: 'Indiquez le nom du titulaire du compte Mobile Money' })
  @MaxLength(160)
  accountName!: string;
}

export class HandleWithdrawalDto {
  @ApiProperty({ enum: ['paid', 'reject'] })
  @IsIn(['paid', 'reject'], { message: 'Action invalide' })
  action!: 'paid' | 'reject';

  @ApiPropertyOptional({ description: 'Référence de la transaction Mobile Money (obligatoire pour « paid »)' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(100)
  reference?: string | null;

  @ApiPropertyOptional({ description: 'Motif du refus, envoyé au vendeur' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class UpdateMarketplaceSettingsDto {
  @ApiProperty({ example: 10, description: 'Commission en %, de 0 à 50' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Taux de commission invalide' })
  @Min(0, { message: 'La commission ne peut pas être négative' })
  @Max(50, { message: 'La commission doit faire au plus 50 %' })
  commissionRate!: number;

  @ApiProperty({ example: 7, description: 'Jours avant qu’une vente soit retirable' })
  @IsInt({ message: 'Le délai doit être un nombre entier de jours' })
  @Min(0)
  @Max(60, { message: 'Le délai doit faire au plus 60 jours' })
  holdDays!: number;

  @ApiProperty({ example: 5000, description: 'Retrait minimum en FCFA' })
  @IsInt({ message: 'Le retrait minimum doit être un nombre entier de FCFA' })
  @Min(500, { message: 'Le retrait minimum doit faire au moins 500 FCFA' })
  @Max(1_000_000)
  minWithdrawal!: number;
}
