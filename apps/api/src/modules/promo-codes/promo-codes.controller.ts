import { Body, ConflictException, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { IpThrottlerGuard } from '../auth/guards/ip-throttler.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SellerAuthGuard } from '../sellers/guards/seller-auth.guard';
import { SellerRequestUser } from '../sellers/strategies/seller-jwt.strategy';
import { ApplyPromoCodeDto, CreatePromoCodeDto, UpdatePromoCodeDto } from './dto/promo-code.dto';
import { PromoCodesService } from './promo-codes.service';

const sellerId = (req: Request) => (req.user as SellerRequestUser).sellerId;
const NO_STORE = 'Créez d’abord votre boutique : les codes promo s’appliquent à ses produits.';

@ApiTags('Codes promo')
@Controller('promo-codes')
@UseGuards(IpThrottlerGuard)
export class PromoCodesController {
  constructor(private readonly promoCodes: PromoCodesService) {}

  @Post('apply')
  @HttpCode(200)
  // Assez pour un client qui se trompe, pas pour deviner des codes.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Vérifier un code promo sur le panier et calculer la réduction (rien n’est réservé)' })
  @ApiResponse({ status: 400, description: 'Code inconnu, expiré, ou sans produit concerné dans le panier' })
  @ApiResponse({ status: 409, description: 'Code épuisé, ou déjà utilisé par ce client' })
  apply(@Body() dto: ApplyPromoCodeDto) {
    return this.promoCodes.preview(dto);
  }
}

@ApiTags('Vendeurs — codes promo')
@ApiBearerAuth()
@Controller('seller/promo-codes')
@UseGuards(SellerAuthGuard)
export class SellerPromoCodesController {
  constructor(private readonly promoCodes: PromoCodesService) {}

  private async store(req: Request) {
    const store = await this.promoCodes.storeOfSeller(sellerId(req));
    if (!store) {
      throw new ConflictException(NO_STORE);
    }
    return store;
  }

  @Get()
  @ApiOperation({ summary: 'Codes promo de la boutique du vendeur connecté' })
  async list(@Req() req: Request) {
    const store = await this.promoCodes.storeOfSeller(sellerId(req));
    return { owner: store?.name ?? null, hasStore: !!store, codes: store ? await this.promoCodes.list(store.id) : [] };
  }

  @Post()
  @ApiOperation({ summary: 'Créer un code promo pour les produits de sa boutique' })
  async create(@Req() req: Request, @Body() dto: CreatePromoCodeDto) {
    return this.promoCodes.create((await this.store(req)).id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Activer ou désactiver un code, changer sa limite ou sa date de fin' })
  async update(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePromoCodeDto) {
    return this.promoCodes.update((await this.store(req)).id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un code qui n’a jamais servi' })
  async remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.promoCodes.remove((await this.store(req)).id, id);
  }
}

@ApiTags('Codes promo — administration')
@ApiBearerAuth()
@Controller('admin/promo-codes')
@UseGuards(JwtAuthGuard)
export class AdminPromoCodesController {
  constructor(private readonly promoCodes: PromoCodesService) {}

  @Get()
  @ApiOperation({ summary: 'Codes promo de BlackStore (produits vendus par BlackStore)' })
  async list() {
    return { owner: 'BlackStore', hasStore: true, codes: await this.promoCodes.list(null) };
  }

  @Post()
  @ApiOperation({ summary: 'Créer un code promo pour les produits de BlackStore' })
  create(@Body() dto: CreatePromoCodeDto) {
    return this.promoCodes.create(null, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Activer ou désactiver un code, changer sa limite ou sa date de fin' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePromoCodeDto) {
    return this.promoCodes.update(null, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un code qui n’a jamais servi' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.promoCodes.remove(null, id);
  }
}
