import { Controller, Post, Body, Req, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('pageview')
  @ApiOperation({ summary: 'Tracker une vue produit (UTM + session)' })
  trackPageView(
    @Body() body: any,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.analyticsService.trackPageView(body, req, ip);
  }
}
