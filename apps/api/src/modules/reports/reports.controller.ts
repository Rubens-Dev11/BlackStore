import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReportStatus } from '@prisma/client';
import { Request } from 'express';
import { IpThrottlerGuard } from '../auth/guards/ip-throttler.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateReportDto, HandleReportDto } from './dto/report.dto';
import { ReportsService } from './reports.service';

/** Adresse du visiteur, posée par Nginx (même source que la limite de tentatives). */
const visitorIp = (req: Request) => {
  const realIp = req.headers['x-real-ip'];
  return (Array.isArray(realIp) ? realIp[0] : realIp) || req.ip;
};

@ApiTags('Signalements')
@Controller('reports')
@UseGuards(IpThrottlerGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  // 5 signalements par heure et par visiteur : assez pour un client, trop peu pour du harcèlement.
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Signaler un produit visible sur le site' })
  @ApiResponse({ status: 201, description: 'Signalement reçu' })
  @ApiResponse({ status: 429, description: 'Trop de signalements depuis cette adresse' })
  create(@Body() dto: CreateReportDto, @Req() req: Request) {
    return this.reportsService.create(dto, visitorIp(req));
  }
}

@ApiTags('Signalements — administration')
@ApiBearerAuth()
@Controller('admin/reports')
@UseGuards(JwtAuthGuard)
export class AdminReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Signalements par statut (à traiter par défaut)' })
  @ApiQuery({ name: 'status', required: false, enum: ReportStatus })
  list(@Query('status', new ParseEnumPipe(ReportStatus, { optional: true })) status?: ReportStatus) {
    return this.reportsService.list(status ?? 'open');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Classer sans suite, ou retirer le produit du site (le vendeur reçoit le motif)' })
  handle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HandleReportDto) {
    return this.reportsService.handle(id, dto.action, dto.note);
  }
}
