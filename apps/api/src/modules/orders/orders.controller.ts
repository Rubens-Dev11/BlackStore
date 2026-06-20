import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Patch,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une commande' })
  @ApiResponse({ status: 201, description: 'Commande créée' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Liste des commandes' })
  @ApiResponse({ status: 200, description: 'Liste des commandes' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('dateFrom') dateFromStr?: string,
    @Query('dateTo') dateToStr?: string,
  ) {
    const dateFrom = parseOptionalDate(dateFromStr, 'dateFrom');
    const dateTo = parseOptionalDate(dateToStr, 'dateTo');
    return this.ordersService.findAll({ page, limit, status, dateFrom, dateTo });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Détails d\'une commande' })
  @ApiResponse({ status: 200, description: 'Détails de la commande' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Commande introuvable' })
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/refund')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rembourser une commande' })
  @ApiResponse({ status: 200, description: 'Commande remboursée' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Commande introuvable' })
  @ApiResponse({ status: 409, description: 'Conflit' })
  async refund(@Param('id') id: string) {
    return this.ordersService.refund(id);
  }

  @Post(':id/resend-download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Renvoyer les liens de téléchargement' })
  @ApiResponse({ status: 200, description: 'Liens renvoyés' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Commande introuvable' })
  @ApiResponse({ status: 409, description: 'Conflit' })
  async resendDownload(@Param('id') id: string) {
    return this.ordersService.resendDownload(id);
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
