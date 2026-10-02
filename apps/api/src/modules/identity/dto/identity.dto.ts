import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IdentityDocumentType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { Equals, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EmptyToNull, Trim } from '../../sellers/dto/seller-fields';

/** Champs texte de l'envoi (formulaire multipart, avec les trois photos). */
export class SubmitIdentityDto {
  @ApiProperty({ enum: IdentityDocumentType })
  @IsEnum(IdentityDocumentType, { message: 'Choisissez le type de pièce : CNI ou passeport' })
  documentType!: IdentityDocumentType;

  @ApiProperty({ description: 'Nom complet tel qu’il figure sur la pièce' })
  @Trim()
  @IsString()
  @MinLength(3, { message: 'Indiquez votre nom complet tel qu’il figure sur la pièce' })
  @MaxLength(160, { message: 'Le nom doit faire au plus 160 caractères' })
  fullName!: string;

  @ApiProperty({ description: 'Accord pour la conservation des documents (« true »)' })
  // Les champs d'un formulaire multipart arrivent en texte, et la conversion automatique ferait de
  // « false » un vrai (toute chaîne non vide) : on lit donc la valeur reçue telle quelle.
  @Transform(({ obj }) => obj.consent === true || obj.consent === 'true')
  @Equals(true, { message: 'Vous devez accepter la conservation de vos documents pour la vérification' })
  consent!: boolean;
}

export class ReviewIdentityDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'], { message: 'Décision invalide' })
  decision!: 'approve' | 'reject';

  @ApiPropertyOptional({ description: 'Motif du refus, envoyé au vendeur' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(500, { message: 'Le motif doit faire au plus 500 caractères' })
  note?: string | null;
}
