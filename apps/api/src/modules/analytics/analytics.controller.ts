import { Controller, Post, Body, Req, HttpCode, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { IpThrottlerGuard } from '../auth/guards/ip-throttler.guard';
import { AnalyticsService } from './analytics.service';
import { TrackPageviewDto } from './dto/track-pageview.dto';

/** Adresse du visiteur, posée par Nginx (derrière lui, req.ip est celle du proxy). */
const visitorIp = (req: Request) => {
  const realIp = req.headers['x-real-ip'];
  return (Array.isArray(realIp) ? realIp[0] : realIp) || req.ip || '';
};

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(IpThrottlerGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('pageview')
  @HttpCode(200)
  // Un visiteur ne consulte pas 60 pages par minute : au-delà, les statistiques seraient gonflées.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Tracker une vue de page produit ou boutique (public, non-bloquant)' })
  @ApiResponse({ status: 200, description: 'Tracking accepté (toujours succès côté client)' })
  trackPageView(@Body() dto: TrackPageviewDto, @Req() req: Request) {
    return this.analyticsService.trackPageView(dto, req, visitorIp(req));
  }
}
