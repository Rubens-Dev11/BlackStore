import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { IpThrottlerGuard } from '../auth/guards/ip-throttler.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SellerAuthGuard } from '../sellers/guards/seller-auth.guard';
import { SellerRequestUser } from '../sellers/strategies/seller-jwt.strategy';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto, DisputeListFilter, FindDisputableOrderDto, HandleDisputeDto, RespondDisputeDto } from './dto/dispute.dto';

/** Adresse du visiteur, posée par Nginx (même source que la limite de tentatives). */
const visitorIp = (req: Request) => {
  const realIp = req.headers['x-real-ip'];
  return (Array.isArray(realIp) ? realIp[0] : realIp) || req.ip;
};
const sellerId = (req: Request) => (req.user as SellerRequestUser).sellerId;

@ApiTags('Remboursements')
@Controller('disputes')
@UseGuards(IpThrottlerGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post('commande')
  @HttpCode(200)
  // Numéro de commande + e-mail : 20 essais par heure suffisent à un client, pas à deviner des commandes.
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Retrouver sa commande (numéro + e-mail) et les produits pour lesquels un remboursement peut être demandé' })
  findOrder(@Body() dto: FindDisputableOrderDto) {
    return this.disputesService.findOrder(dto);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Demander le remboursement d’un produit acheté (litige)' })
  @ApiResponse({ status: 201, description: 'Demande enregistrée ; référence envoyée par e-mail' })
  create(@Body() dto: CreateDisputeDto, @Req() req: Request) {
    return this.disputesService.create(dto, visitorIp(req));
  }
}

@ApiTags('Vendeurs — litiges')
@ApiBearerAuth()
@Controller('seller/disputes')
@UseGuards(SellerAuthGuard)
export class SellerDisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  @ApiOperation({ summary: 'Litiges sur les produits du vendeur connecté' })
  list(@Req() req: Request) {
    return this.disputesService.listForSeller(sellerId(req));
  }

  @Post(':id/respond')
  @HttpCode(200)
  @ApiOperation({ summary: 'Répondre à un litige (une fois), en acceptant ou non le remboursement' })
  respond(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondDisputeDto) {
    return this.disputesService.respond(sellerId(req), id, dto);
  }
}

@ApiTags('Litiges — administration')
@ApiBearerAuth()
@Controller('admin/disputes')
@UseGuards(JwtAuthGuard)
export class AdminDisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  @ApiOperation({ summary: 'Litiges à traiter (par défaut), en attente du vendeur, ou clos' })
  @ApiQuery({ name: 'filter', required: false, enum: ['todo', 'waiting', 'closed'] })
  list(@Query('filter') filter?: string) {
    const value: DisputeListFilter = filter === 'waiting' || filter === 'closed' ? filter : 'todo';
    return this.disputesService.listForAdmin(value);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Accorder le remboursement, le refuser (motif), ou noter l’envoi de l’argent (référence)' })
  handle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HandleDisputeDto) {
    return this.disputesService.handle(id, dto);
  }
}
