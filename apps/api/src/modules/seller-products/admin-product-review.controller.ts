import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProductReviewStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmptyToNull } from '../sellers/dto/seller-fields';
import { AdminProductReviewService } from './admin-product-review.service';

export class ReviewProductDto {
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

@ApiTags('Produits des vendeurs — validation')
@ApiBearerAuth()
@Controller('admin/products')
@UseGuards(JwtAuthGuard)
export class AdminProductReviewController {
  constructor(private readonly reviewService: AdminProductReviewService) {}

  @Get('review')
  @ApiOperation({ summary: 'Produits des vendeurs par statut (en attente par défaut)' })
  @ApiQuery({ name: 'status', required: false, enum: ProductReviewStatus })
  list(@Query('status', new ParseEnumPipe(ProductReviewStatus, { optional: true })) status?: ProductReviewStatus) {
    return this.reviewService.list(status ?? 'pending');
  }

  @Get(':id/file-url')
  @ApiOperation({ summary: 'Lien de téléchargement du fichier (15 minutes), pour l’examiner' })
  fileUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewService.fileUrl(id);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Valider ou refuser un produit de vendeur (le vendeur est prévenu par e-mail)' })
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewProductDto) {
    return this.reviewService.review(id, dto.decision, dto.note);
  }

  @Post(':id/rescan')
  @ApiOperation({ summary: "Relancer l'analyse antivirus d'un fichier" })
  rescan(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewService.rescan(id);
  }
}
