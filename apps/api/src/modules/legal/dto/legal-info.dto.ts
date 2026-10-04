import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { EmptyToNull, SELLER_PHONE_PATTERN } from '../../sellers/dto/seller-fields';

/** Identité de l'éditeur et contact ; un champ vide efface la valeur, un champ absent la garde. */
export class UpdateLegalInfoDto {
  @ApiPropertyOptional({ example: 'Jean Mbarga', description: 'Nom de la personne ou de la société qui exploite BlackStore' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(160, { message: "Le nom de l'éditeur doit faire au plus 160 caractères" })
  legalName?: string | null;

  @ApiPropertyOptional({ example: 'Entreprise individuelle' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(160, { message: 'La forme juridique doit faire au plus 160 caractères' })
  legalForm?: string | null;

  @ApiPropertyOptional({ example: 'Rue de la Joie, Akwa, Douala' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(300, { message: "L'adresse doit faire au plus 300 caractères" })
  legalAddress?: string | null;

  @ApiPropertyOptional({ example: 'RC/DLA/2026/A/1234' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(60, { message: 'Le numéro RCCM doit faire au plus 60 caractères' })
  rccm?: string | null;

  @ApiPropertyOptional({ example: 'P012345678901A', description: "Numéro d'identifiant unique (impôts)" })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(30, { message: 'Le NIU doit faire au plus 30 caractères' })
  niu?: string | null;

  @ApiPropertyOptional({ example: 'contact@exemple.cm' })
  @IsOptional()
  @EmptyToNull()
  @IsEmail({}, { message: "L'e-mail de contact doit être valide" })
  @MaxLength(150)
  contactEmail?: string | null;

  @ApiPropertyOptional({ example: '+237 6 99 00 00 00', description: 'Téléphone ou WhatsApp affiché aux clients' })
  @IsOptional()
  @EmptyToNull()
  @Matches(SELLER_PHONE_PATTERN, { message: 'Numéro de téléphone de contact invalide' })
  contactPhone?: string | null;

  @ApiPropertyOptional({ example: 'Société X, Bonanjo, Douala (Cameroun)' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(300, { message: "L'hébergeur doit faire au plus 300 caractères" })
  hostingInfo?: string | null;
}
