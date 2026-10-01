import { IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { SELLER_PHONE_MESSAGE, SELLER_PHONE_PATTERN, Trim } from '../../sellers/dto/seller-fields';

/** Champ facultatif : une chaîne vide (champ effacé dans le formulaire) vaut « aucune valeur ». */
const EmptyToNull = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });

const httpsUrl = (label: string) =>
  IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: `Le lien ${label} doit être une adresse complète en https://` },
  );

export class UpsertStoreDto {
  @ApiProperty({ example: 'Awa Digital' })
  @Trim()
  @IsString()
  @MinLength(2, { message: 'Le nom de la boutique doit faire au moins 2 caractères' })
  @MaxLength(60, { message: 'Le nom de la boutique doit faire au plus 60 caractères' })
  name!: string;

  @ApiProperty({ example: 'awa-digital', description: 'Adresse : /boutique/<slug>' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "L'adresse ne peut contenir que des lettres minuscules sans accent, des chiffres et des tirets",
  })
  @MinLength(3, { message: "L'adresse doit faire au moins 3 caractères" })
  @MaxLength(40, { message: "L'adresse doit faire au plus 40 caractères" })
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(1000, { message: 'La description doit faire au plus 1 000 caractères' })
  description?: string | null;

  @ApiPropertyOptional({ example: 'https://www.facebook.com/awadigital' })
  @IsOptional()
  @EmptyToNull()
  @httpsUrl('Facebook')
  @MaxLength(200)
  facebookUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://www.instagram.com/awadigital' })
  @IsOptional()
  @EmptyToNull()
  @httpsUrl('Instagram')
  @MaxLength(200)
  instagramUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://www.tiktok.com/@awadigital' })
  @IsOptional()
  @EmptyToNull()
  @httpsUrl('TikTok')
  @MaxLength(200)
  tiktokUrl?: string | null;

  @ApiPropertyOptional({ example: '+237 6 99 00 00 00' })
  @IsOptional()
  @EmptyToNull()
  @Matches(SELLER_PHONE_PATTERN, { message: `WhatsApp : ${SELLER_PHONE_MESSAGE.toLowerCase()}` })
  whatsapp?: string | null;
}
