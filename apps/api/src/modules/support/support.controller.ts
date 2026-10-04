import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SupportStatus } from '@prisma/client';
import { Request } from 'express';
import { IpThrottlerGuard } from '../auth/guards/ip-throttler.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSupportRequestDto, HandleSupportRequestDto } from './dto/support.dto';
import { SupportService } from './support.service';

/** Adresse du visiteur, posée par Nginx (même source que la limite de tentatives). */
const visitorIp = (req: Request) => {
  const realIp = req.headers['x-real-ip'];
  return (Array.isArray(realIp) ? realIp[0] : realIp) || req.ip;
};

@ApiTags('Contact')
@Controller('contact')
@UseGuards(IpThrottlerGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  // 5 messages par heure et par visiteur : assez pour un client, trop peu pour inonder la boîte.
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Envoyer un message à l’équipe BlackStore (remboursement, commande, données…)' })
  @ApiResponse({ status: 201, description: 'Message reçu' })
  @ApiResponse({ status: 429, description: 'Trop de messages depuis cette adresse' })
  create(@Body() dto: CreateSupportRequestDto, @Req() req: Request) {
    return this.supportService.create(dto, visitorIp(req));
  }
}

@ApiTags('Contact — administration')
@ApiBearerAuth()
@Controller('admin/messages')
@UseGuards(JwtAuthGuard)
export class AdminSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  @ApiOperation({ summary: 'Messages du formulaire de contact (à traiter par défaut)' })
  @ApiQuery({ name: 'status', required: false, enum: SupportStatus })
  list(@Query('status', new ParseEnumPipe(SupportStatus, { optional: true })) status?: SupportStatus) {
    return this.supportService.list(status ?? 'open');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Répondre par e-mail, classer ou rouvrir un message' })
  handle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HandleSupportRequestDto) {
    return this.supportService.handle(id, dto.action, dto.reply);
  }
}
