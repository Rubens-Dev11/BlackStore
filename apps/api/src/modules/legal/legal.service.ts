import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceSettings } from '@prisma/client';
import { PrismaService } from '@/prisma';
import { UpdateLegalInfoDto } from './dto/legal-info.dto';
import { LEGAL_VERSION } from './legal-version';

/**
 * Informations affichées dans les pages légales du site : identité de l'éditeur, contact, hébergeur
 * (remplis par l'administrateur) et règles de la marketplace (commission, délai, retrait minimum).
 */
@Injectable()
export class LegalService {
  private readonly logger = new Logger(LegalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private settings(): Promise<MarketplaceSettings> {
    return this.prisma.marketplaceSettings.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} });
  }

  private url(key: string, fallback: string): string {
    return this.configService.get<string>(key, fallback).replace(/\/+$/, '');
  }

  async publicInfo() {
    const s = await this.settings();
    return {
      version: LEGAL_VERSION,
      operator: { name: s.legalName, form: s.legalForm, address: s.legalAddress, rccm: s.rccm, niu: s.niu },
      contact: { email: s.contactEmail, phone: s.contactPhone },
      hosting: s.hostingInfo,
      marketplace: { commissionRate: Number(s.commissionRate), holdDays: s.holdDays, minWithdrawal: s.minWithdrawal },
      urls: {
        storefront: this.url('STOREFRONT_URL', 'http://localhost:3001'),
        sellerApp: this.url('SELLER_APP_URL', 'http://localhost:3002'),
      },
    };
  }

  async adminInfo() {
    return LegalService.adminView(await this.settings());
  }

  async update(dto: UpdateLegalInfoDto) {
    const settings = await this.prisma.marketplaceSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...dto },
      update: dto,
    });
    this.logger.log('Informations légales mises à jour');
    return LegalService.adminView(settings);
  }

  private static adminView(s: MarketplaceSettings) {
    return {
      legalName: s.legalName,
      legalForm: s.legalForm,
      legalAddress: s.legalAddress,
      rccm: s.rccm,
      niu: s.niu,
      contactEmail: s.contactEmail,
      contactPhone: s.contactPhone,
      hostingInfo: s.hostingInfo,
      updatedAt: s.updatedAt,
    };
  }
}
