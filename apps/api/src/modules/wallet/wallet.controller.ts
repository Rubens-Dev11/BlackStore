import { Body, Controller, DefaultValuePipe, Get, Param, ParseEnumPipe, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WithdrawalStatus } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SellerAuthGuard } from '../sellers/guards/seller-auth.guard';
import { SellerRequestUser } from '../sellers/strategies/seller-jwt.strategy';
import { HandleWithdrawalDto, RequestWithdrawalDto, UpdateMarketplaceSettingsDto } from './dto/wallet.dto';
import { WalletService } from './wallet.service';

const sellerId = (req: Request) => (req.user as SellerRequestUser).sellerId;

@ApiTags('Vendeurs — portefeuille')
@ApiBearerAuth()
@Controller('seller/wallet')
@UseGuards(SellerAuthGuard)
export class SellerWalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Solde, gains, réglages et possibilité de retrait du vendeur connecté' })
  summary(@Req() req: Request) {
    return this.walletService.summaryFor(sellerId(req));
  }

  @Get('entries')
  @ApiOperation({ summary: 'Historique des mouvements (50 par page)' })
  @ApiQuery({ name: 'page', required: false })
  entries(@Req() req: Request, @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) {
    return this.walletService.entriesFor(sellerId(req), Math.max(1, page));
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'Retraits du vendeur' })
  withdrawals(@Req() req: Request) {
    return this.walletService.withdrawalsFor(sellerId(req));
  }

  @Get('withdrawals/:id')
  @ApiOperation({ summary: 'Détail d’un retrait (reçu)' })
  withdrawal(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.walletService.withdrawalFor(sellerId(req), id);
  }

  @Post('withdrawals')
  @ApiOperation({ summary: 'Demander un retrait vers Orange Money ou MTN Mobile Money' })
  request(@Req() req: Request, @Body() dto: RequestWithdrawalDto) {
    return this.walletService.requestWithdrawal(sellerId(req), dto);
  }

  @Post('withdrawals/:id/cancel')
  @ApiOperation({ summary: 'Annuler un retrait pas encore payé' })
  cancel(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.walletService.cancelWithdrawal(sellerId(req), id);
  }
}

@ApiTags('Portefeuille — administration')
@ApiBearerAuth()
@Controller('admin/wallet')
@UseGuards(JwtAuthGuard)
export class AdminWalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Ventes, commissions, soldes des vendeurs et retraits' })
  summary() {
    return this.walletService.adminSummary();
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'Retraits par statut (à payer par défaut)' })
  @ApiQuery({ name: 'status', required: false, enum: WithdrawalStatus })
  withdrawals(@Query('status', new ParseEnumPipe(WithdrawalStatus, { optional: true })) status?: WithdrawalStatus) {
    return this.walletService.listWithdrawals(status ?? 'pending');
  }

  @Patch('withdrawals/:id')
  @ApiOperation({ summary: 'Marquer un retrait comme payé (référence de l’envoi) ou le refuser (motif)' })
  handle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HandleWithdrawalDto) {
    return this.walletService.handleWithdrawal(id, dto.action, dto.reference, dto.note);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Commission, délai de sécurité et retrait minimum' })
  async settings() {
    return WalletService.settingsView(await this.walletService.getSettings());
  }

  @Put('settings')
  @ApiOperation({ summary: 'Modifier les réglages (valables pour les ventes à venir)' })
  updateSettings(@Body() dto: UpdateMarketplaceSettingsDto) {
    return this.walletService.updateSettings(dto);
  }
}
