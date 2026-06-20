import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('product/:productId')
  @ApiOperation({ summary: 'Avis approuvés d\'un produit (public)' })
  @ApiResponse({ status: 200, description: 'Liste des avis approuvés avec moyenne' })
  @ApiResponse({ status: 404, description: 'Produit introuvable' })
  findByProduct(@Param('productId') productId: string) {
    return this.reviewsService.findByProduct(productId);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Soumettre un avis (acheteur vérifié)' })
  @ApiResponse({ status: 201, description: 'Avis soumis (en attente de modération)' })
  @ApiResponse({ status: 403, description: 'Achat non trouvé pour cet email' })
  @ApiResponse({ status: 404, description: 'Produit introuvable' })
  create(@Param('productId') productId: string, @Body() createReviewDto: CreateReviewDto) {
    return this.reviewsService.create(productId, createReviewDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tous les avis (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isApproved', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Liste paginée des avis' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isApproved', new ParseBoolPipe({ optional: true })) isApproved?: boolean,
  ) {
    return this.reviewsService.findAll({ page, limit, isApproved });
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approuver un avis (admin)' })
  @ApiResponse({ status: 200, description: 'Avis approuvé' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Avis introuvable' })
  approve(@Param('id') id: string) {
    return this.reviewsService.approve(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un avis (admin)' })
  @ApiResponse({ status: 200, description: 'Avis supprimé' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Avis introuvable' })
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
