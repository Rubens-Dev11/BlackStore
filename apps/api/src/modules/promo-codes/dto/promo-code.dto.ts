import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MAX_AMOUNT, normalizePromoCode } from '../promo-rules';

const toCode = ({ value }: { value: unknown }) => (typeof value === 'string' ? normalizePromoCode(value) : value);
// Seul un vrai booléen compte (la conversion automatique ferait de « false » un vrai).
const strictBoolean = (key: string) => ({ obj }: { obj: Record<string, unknown> }) =>
  obj[key] === true ? true : obj[key] === false ? false : obj[key] === undefined ? undefined : 'invalide';

export class CreatePromoCodeDto {
  @ApiProperty({ example: 'NOEL10', description: '3 à 30 caractères : lettres, chiffres, tiret, souligné (mis en majuscules)' })
  @Transform(toCode)
  @IsString()
  @Matches(/^[A-Z0-9_-]{3,30}$/, { message: 'Le code compte 3 à 30 caractères : lettres sans accent, chiffres, tiret ou souligné.' })
  code!: string;

  @ApiProperty({ enum: ['percent', 'amount'] })
  @IsIn(['percent', 'amount'], { message: 'Choisissez une réduction en pourcentage ou en montant.' })
  discountType!: 'percent' | 'amount';

  @ApiProperty({ description: 'Pourcentage (1 à 100) ou montant en FCFA (multiple de 5)' })
  @Type(() => Number)
  @IsInt({ message: 'La réduction doit être un nombre entier.' })
  @Min(1, { message: 'La réduction doit être d’au moins 1.' })
  @Max(MAX_AMOUNT, { message: 'La réduction est trop élevée.' })
  value!: number;

  @ApiPropertyOptional({ description: 'Nombre maximal d’utilisations (vide = illimité)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le nombre d’utilisations doit être un nombre entier.' })
  @Min(1, { message: 'Le nombre d’utilisations doit être d’au moins 1.' })
  @Max(100_000, { message: 'Le nombre d’utilisations est trop élevé.' })
  maxUses?: number;

  @ApiPropertyOptional({ description: 'Une seule utilisation par adresse e-mail' })
  @IsOptional()
  @Transform(strictBoolean('oncePerCustomer'))
  @IsBoolean({ message: 'Réglage « une fois par client » invalide.' })
  oncePerCustomer?: boolean;

  @ApiPropertyOptional({ description: 'Fin de validité (date et heure ISO)' })
  @IsOptional()
  @IsDateString({}, { message: 'Date de fin invalide.' })
  expiresAt?: string;
}

/** Activer ou désactiver, changer la limite d'utilisations ou la date de fin (null = sans limite). */
export class UpdatePromoCodeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(strictBoolean('isActive'))
  @IsBoolean({ message: 'État invalide.' })
  isActive?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.maxUses !== null)
  @Type(() => Number)
  @IsInt({ message: 'Le nombre d’utilisations doit être un nombre entier.' })
  @Min(1, { message: 'Le nombre d’utilisations doit être d’au moins 1.' })
  @Max(100_000, { message: 'Le nombre d’utilisations est trop élevé.' })
  maxUses?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.expiresAt !== null)
  @IsDateString({}, { message: 'Date de fin invalide.' })
  expiresAt?: string | null;
}

export class PromoCartItemDto {
  @IsString()
  @MaxLength(60)
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}

/** Vérifier un code sur le panier, avant de commander. */
export class ApplyPromoCodeDto {
  @ApiProperty()
  @Transform(toCode)
  @IsString()
  @Matches(/^[A-Z0-9_-]{1,40}$/, { message: 'Ce code promo n’existe pas ou n’est plus actif.' })
  code!: string;

  @ApiProperty({ type: [PromoCartItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Votre panier est vide.' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PromoCartItemDto)
  items!: PromoCartItemDto[];

  @ApiPropertyOptional({ description: 'Pour les codes valables une fois par client' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @ValidateIf((o) => o.email !== '')
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email?: string;
}
