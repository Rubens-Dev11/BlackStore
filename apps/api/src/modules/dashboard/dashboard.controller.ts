import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'KPIs: revenus, commandes, taux conversion' })
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Sources trafic, top produits' })
  getAnalytics() {
    return this.dashboardService.getAnalytics();
  }

  @Get('sales-chart')
  @ApiOperation({ summary: 'Courbe des ventes' })
  getSalesChart(@Query('period') period: string, @Query('groupBy') groupBy: string) {
    return this.dashboardService.getSalesChart(period, groupBy);
  }
}
