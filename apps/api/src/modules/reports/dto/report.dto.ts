import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportReason } from '@prisma/client';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { EmptyToNull, NormalizeEmail } from '../../sellers/dto/seller-fields';

export class CreateReportDto {
  @ApiProperty()
  @IsUUID('4', { message: 'Produit invalide' })
  productId!: string;

  @ApiProperty({ enum: ReportReason })
  @IsEnum(ReportReason, { message: 'Choisissez un motif' })
  reason!: ReportReason;

  @ApiPropertyOptional({ description: 'Précisions (obligatoires pour le motif « autre »)' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(1000, { message: 'Les précisions doivent faire au plus 1 000 caractères' })
  details?: string | null;

  @ApiPropertyOptional({ description: "Adresse pour être recontacté (facultatif)" })
  @IsOptional()
  @NormalizeEmail()
  @EmptyToNull()
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @MaxLength(150)
  email?: string | null;
}

export class HandleReportDto {
  @ApiProperty({ enum: ['dismiss', 'remove-product'] })
  @IsIn(['dismiss', 'remove-product'], { message: 'Action invalide' })
  action!: 'dismiss' | 'remove-product';

  @ApiPropertyOptional({ description: 'Décision ; pour un retrait, motif envoyé au vendeur' })
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(500, { message: 'La note doit faire au plus 500 caractères' })
  note?: string | null;
}
