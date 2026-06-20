import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'KPIs globaux admin' })
  @ApiResponse({ status: 200, description: 'Statistiques du tableau de bord' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Sources trafic, top produits, entonnoir conversion' })
  @ApiResponse({ status: 200, description: 'Données analytics' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  getAnalytics() {
    return this.dashboardService.getAnalytics();
  }

  @Get('sales-chart')
  @ApiOperation({ summary: 'Courbe des ventes par jour' })
  @ApiQuery({ name: 'days', required: false, type: Number, example: 30 })
  @ApiResponse({ status: 200, description: 'Revenus et commandes par jour' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  getSalesChart(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.dashboardService.getSalesChart(days);
  }

  @Get('export-orders')
  @ApiOperation({ summary: 'Exporter les commandes en CSV' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Fichier CSV' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async exportOrdersCsv(
    @Query('dateFrom') dateFromStr?: string,
    @Query('dateTo') dateToStr?: string,
    @Res() res: Response,
  ) {
    const dateFrom = parseOptionalDate(dateFromStr, 'dateFrom');
    const dateTo = parseOptionalDate(dateToStr, 'dateTo');

    const csv = await this.dashboardService.exportOrdersCsv({ dateFrom, dateTo });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="commandes.csv"');
    res.send(csv);
  }
}

function parseOptionalDate(value: string | undefined, field: string): Date | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Paramètre "${field}" invalide : date attendue (ex. 2026-01-01)`);
  }
  return date;
}
