import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EmptyToNull } from '../../sellers/dto/seller-fields';
import { YouTubeVideoUrl } from '../youtube';

export class CreateProductDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsUUID()
  categoryId!: string;

  @IsString()
  @IsOptional()
  version?: string;

  @IsString()
  @IsOptional()
  compatibility?: string;

  @IsNumber()
  @IsOptional()
  downloadLimit?: number;

  @IsNumber()
  @IsOptional()
  downloadExpiryHours?: number;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsOptional()
  @IsIn(['android', 'desktop', 'multiplatform'], { message: 'Plateforme invalide' })
  platform?: 'android' | 'desktop' | 'multiplatform';

  // ── Champs de la fiche produit (une chaîne vide efface la valeur) ──

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(300, { message: 'La description courte doit faire au plus 300 caractères' })
  shortDescription?: string | null;

  @IsOptional()
  @IsInt({ message: 'Le prix barré doit être un nombre entier de FCFA' })
  @Min(0)
  originalPrice?: number | null;

  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? [...new Set(value.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))] : value,
  )
  @IsArray()
  @ArrayMaxSize(20, { message: '20 tags au maximum' })
  @IsString({ each: true })
  @MaxLength(40, { each: true, message: 'Chaque tag doit faire au plus 40 caractères' })
  tags?: string[];

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(20000, { message: "Le guide d'installation doit faire au plus 20 000 caractères" })
  installGuide?: string | null;

  /** Vidéo de présentation (motion design, démonstration), affichée en tête de la fiche. */
  @YouTubeVideoUrl()
  demoVideoUrl?: string | null;

  /** Vidéo du guide d'installation. */
  @YouTubeVideoUrl()
  installVideoUrl?: string | null;

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(70, { message: 'Le titre SEO doit faire au plus 70 caractères' })
  seoTitle?: string | null;

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(160, { message: 'La description SEO doit faire au plus 160 caractères' })
  seoDescription?: string | null;
}
