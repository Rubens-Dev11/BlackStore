import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EmptyToNull, Trim } from '../../sellers/dto/seller-fields';
import { YouTubeVideoUrl } from '../../products/youtube';

export const SELLER_PRICE_MAX = 1_000_000;

export class CreateSellerProductDto {
  @ApiProperty({ example: 'Pack de 50 modèles Canva pour commerçants' })
  @Trim()
  @IsString()
  @MinLength(3, { message: 'Le nom du produit doit faire au moins 3 caractères' })
  @MaxLength(120, { message: 'Le nom du produit doit faire au plus 120 caractères' })
  name!: string;

  @ApiPropertyOptional({ description: 'Accroche affichée dans le catalogue' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(160, { message: "L'accroche doit faire au plus 160 caractères" })
  shortDescription?: string | null;

  @ApiPropertyOptional({ description: 'Texte brut ; les lignes vides séparent les paragraphes' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(5000, { message: 'La description doit faire au plus 5 000 caractères' })
  description?: string | null;

  @ApiProperty({ example: 2500, description: 'Prix en FCFA : 0 (gratuit) ou de 100 à 1 000 000, multiple de 5' })
  @IsInt({ message: 'Le prix doit être un nombre entier de FCFA' })
  @Min(0, { message: 'Le prix ne peut pas être négatif' })
  @Max(SELLER_PRICE_MAX, { message: 'Le prix doit faire au plus 1 000 000 FCFA' })
  price!: number;

  @ApiPropertyOptional({ description: 'Prix barré (avant réduction), supérieur au prix' })
  @IsOptional()
  @IsInt({ message: 'Le prix barré doit être un nombre entier de FCFA' })
  @Max(SELLER_PRICE_MAX, { message: 'Le prix barré doit faire au plus 1 000 000 FCFA' })
  originalPrice?: number | null;

  @ApiProperty()
  @IsUUID('4', { message: 'Choisissez une catégorie' })
  categoryId!: string;

  @ApiPropertyOptional({ enum: ['android', 'desktop', 'multiplatform'] })
  @IsOptional()
  @IsIn(['android', 'desktop', 'multiplatform'], { message: 'Plateforme invalide' })
  platform?: 'android' | 'desktop' | 'multiplatform';

  @ApiPropertyOptional({ example: '1.0' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(20, { message: 'La version doit faire au plus 20 caractères' })
  version?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? [...new Set(value.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))] : value,
  )
  @IsArray()
  @ArrayMaxSize(8, { message: '8 mots-clés au maximum' })
  @IsString({ each: true })
  @MaxLength(30, { each: true, message: 'Chaque mot-clé doit faire au plus 30 caractères' })
  tags?: string[];

  @ApiPropertyOptional({
    example: 'https://youtu.be/dQw4w9WgXcQ',
    description: 'Vidéo de présentation sur YouTube (motion design, démonstration), affichée en tête de la fiche ; chaîne vide pour la retirer',
  })
  @YouTubeVideoUrl()
  demoVideoUrl?: string | null;
}

export class UpdateSellerProductDto extends PartialType(CreateSellerProductDto) {}

export class SubmitSellerProductDto {
  @ApiProperty({ description: 'Le vendeur certifie détenir les droits de vente du produit' })
  // Seul un vrai booléen « true » vaut certification (la conversion automatique ferait de « false » un vrai).
  @Transform(({ obj }) => obj.certifyRights === true)
  @Equals(true, { message: 'Vous devez certifier détenir les droits de vente de ce produit' })
  certifyRights!: boolean;
}

export class SellerProductVisibilityDto {
  @ApiProperty({ description: 'Afficher (true) ou masquer (false) un produit validé' })
  @IsBoolean()
  isActive!: boolean;
}
