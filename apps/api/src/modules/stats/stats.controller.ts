import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SellerAuthGuard } from '../sellers/guards/seller-auth.guard';
import { SellerRequestUser } from '../sellers/strategies/seller-jwt.strategy';
import { SellerStatsService } from './seller-stats.service';
import { PERIODS } from './stats-period';

const sellerId = (req: Request) => (req.user as SellerRequestUser).sellerId;

@ApiTags('Vendeurs — statistiques')
@ApiBearerAuth()
@Controller('seller/stats')
@UseGuards(SellerAuthGuard)
export class SellerStatsController {
  constructor(private readonly stats: SellerStatsService) {}

  @Get()
  @ApiOperation({ summary: 'Visites, ventes, gains, produits et provenance des visiteurs de sa boutique' })
  @ApiQuery({ name: 'period', required: false, enum: PERIODS })
  get(@Req() req: Request, @Query('period') period?: string) {
    return this.stats.stats(sellerId(req), period);
  }

  @Get('report')
  @ApiOperation({ summary: 'Relevé d’un mois : ventes, remboursements, retraits et solde' })
  @ApiQuery({ name: 'month', required: true, example: '2026-10' })
  report(@Req() req: Request, @Query('month') month?: string) {
    return this.stats.monthlyReport(sellerId(req), month);
  }
}

@ApiTags('Statistiques — administration')
@ApiBearerAuth()
@Controller('admin/stats')
@UseGuards(JwtAuthGuard)
export class AdminStatsController {
  constructor(private readonly stats: SellerStatsService) {}

  @Get('sellers')
  @ApiOperation({ summary: 'Classement des boutiques (vues, ventes, chiffre d’affaires, commission), avec BlackStore' })
  @ApiQuery({ name: 'period', required: false, enum: PERIODS })
  ranking(@Query('period') period?: string) {
    return this.stats.ranking(period);
  }

  @Get('sellers/:sellerId')
  @ApiOperation({ summary: 'Statistiques d’un vendeur (les mêmes que dans son espace)' })
  @ApiQuery({ name: 'period', required: false, enum: PERIODS })
  seller(@Param('sellerId', ParseUUIDPipe) id: string, @Query('period') period?: string) {
    return this.stats.stats(id, period);
  }

  @Get('sellers/:sellerId/report')
  @ApiOperation({ summary: 'Relevé mensuel d’un vendeur' })
  @ApiQuery({ name: 'month', required: true, example: '2026-10' })
  report(@Param('sellerId', ParseUUIDPipe) id: string, @Query('month') month?: string) {
    return this.stats.monthlyReport(id, month);
  }
}
