import { Controller, Post, Body, Req, Ip, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { TrackPageviewDto } from './dto/track-pageview.dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('pageview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Tracker une vue de page (public, non-bloquant)' })
  @ApiResponse({ status: 200, description: 'Tracking accepté (toujours succès côté client)' })
  trackPageView(
    @Body() dto: TrackPageviewDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.analyticsService.trackPageView(dto, req, ip);
  }
}
