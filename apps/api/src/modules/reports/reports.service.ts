import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReportStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma';
import { FileStorageService } from '../file-storage/file-storage.service';
import { PUBLIC_PRODUCT_WHERE } from '../products/product-visibility';
import { AdminProductReviewService } from '../seller-products/admin-product-review.service';
import { CreateReportDto } from './dto/report.dto';

const COVER_URL_TTL = 24 * 3600;

const REPORT_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      coverImageUrl: true,
      isActive: true,
      reviewStatus: true,
      storeId: true,
      store: {
        select: {
          name: true,
          slug: true,
          seller: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
        },
      },
    },
  },
} satisfies Prisma.ProductReportInclude;

type ReportRecord = Prisma.ProductReportGetPayload<{ include: typeof REPORT_INCLUDE }>;

/** Signalements de produits par les visiteurs, traités par l'administrateur. */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly productReviewService: AdminProductReviewService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Nouveau signalement d'un produit visible sur le site. Un visiteur qui signale
   * deux fois le même produit (signalement encore ouvert) n'en crée pas un second.
   */
  async create(dto: CreateReportDto, ip: string | undefined) {
    if (dto.reason === 'other' && (dto.details?.trim().length ?? 0) < 10) {
      throw new BadRequestException('Décrivez le problème en quelques mots (10 caractères au moins)');
    }
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, ...PUBLIC_PRODUCT_WHERE },
      select: { id: true, slug: true },
    });
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }

    const ipHash = ip ? createHash('sha256').update(ip).digest('hex') : null;
    if (ipHash) {
      const duplicate = await this.prisma.productReport.findFirst({
        where: { productId: product.id, ipHash, status: 'open' },
        select: { id: true },
      });
      if (duplicate) {
        return { received: true };
      }
    }

    await this.prisma.productReport.create({
      data: {
        productId: product.id,
        reason: dto.reason,
        details: dto.details ?? null,
        reporterEmail: dto.email ?? null,
        ipHash,
      },
    });
    this.logger.log(`Signalement « ${dto.reason} » sur le produit ${product.slug}`);
    return { received: true };
  }

  /** Signalements d'un statut ; la file « open » commence par les plus anciens. */
  async list(status: ReportStatus) {
    const reports = await this.prisma.productReport.findMany({
      where: { status },
      orderBy: status === 'open' ? { createdAt: 'asc' } : { resolvedAt: 'desc' },
      take: 200,
      include: REPORT_INCLUDE,
    });
    // Nombre de signalements encore ouverts par produit : plusieurs signalements pèsent plus lourd.
    const openCounts = await this.prisma.productReport.groupBy({
      by: ['productId'],
      where: { status: 'open', productId: { in: [...new Set(reports.map((r) => r.productId))] } },
      _count: { _all: true },
    });
    const countOf = new Map(openCounts.map((c) => [c.productId, c._count._all]));
    return Promise.all(reports.map((r) => this.toAdminView(r, countOf.get(r.productId) ?? 0)));
  }

  /**
   * Décision de l'administrateur :
   * - « dismiss » : signalement classé sans suite ;
   * - « remove-product » : produit retiré du site (un produit de vendeur est refusé avec le motif,
   *   envoyé au vendeur) et tous les signalements ouverts du produit sont résolus.
   */
  async handle(reportId: string, action: 'dismiss' | 'remove-product', note?: string | null) {
    const report = await this.prisma.productReport.findUnique({ where: { id: reportId }, include: REPORT_INCLUDE });
    if (!report) {
      throw new NotFoundException('Signalement introuvable');
    }
    if (report.status !== 'open') {
      throw new ConflictException('Ce signalement a déjà été traité');
    }

    if (action === 'dismiss') {
      const updated = await this.prisma.productReport.update({
        where: { id: report.id },
        data: { status: 'dismissed', resolutionNote: note?.trim() || 'Classé sans suite', resolvedAt: new Date() },
        include: REPORT_INCLUDE,
      });
      return this.toAdminView(updated, await this.openCount(report.productId));
    }

    const reason = note?.trim() ?? '';
    if (reason.length < 5) {
      throw new BadRequestException('Indiquez le motif du retrait (5 caractères au moins)');
    }
    const { product } = report;
    if (product.storeId) {
      // Produit de vendeur : même décision qu'un refus, le vendeur reçoit le motif par e-mail.
      if (product.reviewStatus === 'approved' || product.reviewStatus === 'pending') {
        await this.productReviewService.review(product.id, 'reject', reason);
      }
    } else if (product.isActive) {
      await this.prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
    }
    await this.prisma.productReport.updateMany({
      where: { productId: product.id, status: 'open' },
      data: { status: 'resolved', resolutionNote: `Produit retiré : ${reason}`, resolvedAt: new Date() },
    });
    this.logger.warn(`Produit ${product.slug} retiré du site après signalement : ${reason}`);

    const updated = await this.prisma.productReport.findUniqueOrThrow({ where: { id: report.id }, include: REPORT_INCLUDE });
    return this.toAdminView(updated, 0);
  }

  private openCount(productId: string) {
    return this.prisma.productReport.count({ where: { productId, status: 'open' } });
  }

  private async toAdminView(report: ReportRecord, openReportsOnProduct: number) {
    const storefront = this.configService.get<string>('STOREFRONT_URL', 'http://localhost:3001').replace(/\/+$/, '');
    const { product } = report;
    return {
      id: report.id,
      reason: report.reason,
      details: report.details,
      reporterEmail: report.reporterEmail,
      status: report.status,
      resolutionNote: report.resolutionNote,
      resolvedAt: report.resolvedAt,
      createdAt: report.createdAt,
      openReportsOnProduct,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        publicUrl: `${storefront}/produits/${product.slug}`,
        coverUrl: product.coverImageUrl
          ? await this.fileStorageService.getPresignedUrl(product.coverImageUrl, COVER_URL_TTL)
          : null,
        // Encore en vente : actif et validé (la visibilité d'un vendeur dépend aussi de son compte).
        onSale: product.isActive && product.reviewStatus === 'approved',
        store: product.store ? { name: product.store.name, slug: product.store.slug } : null,
        seller: product.store?.seller ?? null,
      },
    };
  }
}
