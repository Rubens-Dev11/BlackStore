import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('product/:productId')
  @ApiOperation({ summary: 'Avis approuvés d\'un produit (public)' })
  findProductReviews(@Param('productId') productId: string) {
    return this.reviewsService.findProductReviews(productId);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Soumettre un avis' })
  create(@Param('productId') productId: string, @Body() createReviewDto: any) {
    return this.reviewsService.create(productId, createReviewDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tous les avis (Admin)' })
  findAll() {
    return this.reviewsService.findAll();
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approuver/refuser un avis' })
  approve(@Param('id') id: string, @Body() body: { isApproved: boolean }) {
    return this.reviewsService.approve(id, body.isApproved);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un avis' })
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
