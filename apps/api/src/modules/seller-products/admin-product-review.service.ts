import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ProductReviewStatus } from '@prisma/client';
import { PrismaService } from '@/prisma';
import { FileStorageService } from '../file-storage/file-storage.service';
import { EmailService } from '../email/email.service';
import { AntivirusService } from '../antivirus/antivirus.service';

const IMAGE_URL_TTL = 24 * 3600;
const FILE_URL_TTL = 15 * 60;

const REVIEW_INCLUDE = {
  category: { select: { name: true } },
  store: {
    select: {
      name: true,
      slug: true,
      seller: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
    },
  },
} satisfies Prisma.ProductInclude;

type ReviewRecord = Prisma.ProductGetPayload<{ include: typeof REVIEW_INCLUDE }>;

/** Validation des produits des vendeurs par l'administrateur. */
@Injectable()
export class AdminProductReviewService {
  private readonly logger = new Logger(AdminProductReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly emailService: EmailService,
    private readonly antivirusService: AntivirusService,
  ) {}

  /** Produits des vendeurs d'un statut donné ; les plus anciennes soumissions d'abord. */
  async list(status: ProductReviewStatus) {
    const products = await this.prisma.product.findMany({
      where: { storeId: { not: null }, reviewStatus: status },
      orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
      include: REVIEW_INCLUDE,
    });
    return Promise.all(products.map((p) => this.toAdminView(p)));
  }

  /** Lien de téléchargement temporaire du fichier, pour l'examiner avant de décider. */
  async fileUrl(productId: string) {
    const product = await this.find(productId);
    if (!product.filePath) {
      throw new NotFoundException("Ce produit n'a pas de fichier");
    }
    if (product.scanStatus !== 'clean') {
      throw new ConflictException("Le fichier n'a pas encore passé l'analyse antivirus");
    }
    const fileName = product.filePath.split('/').pop() ?? 'fichier';
    const url = await this.fileStorageService.getPresignedUrl(product.filePath, FILE_URL_TTL, {
      'response-content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'response-content-type': 'application/octet-stream',
    });
    return { url, fileName, expiresInSeconds: FILE_URL_TTL };
  }

  /**
   * Valider (produit en attente ou refusé) ou refuser (en attente ou déjà publié, avec un motif).
   * Le vendeur est prévenu par e-mail.
   */
  async review(productId: string, decision: 'approve' | 'reject', note?: string | null) {
    const product = await this.find(productId);
    const seller = product.store!.seller;

    if (decision === 'approve') {
      if (!['pending', 'rejected'].includes(product.reviewStatus)) {
        throw new ConflictException("Ce produit n'est pas en attente de validation");
      }
      if (!product.filePath || product.scanStatus !== 'clean') {
        throw new ConflictException("Le fichier du produit n'a pas passé l'analyse antivirus");
      }
    } else {
      if (!['pending', 'approved'].includes(product.reviewStatus)) {
        throw new ConflictException('Seul un produit en attente ou publié peut être refusé');
      }
      if (!note || note.trim().length < 5) {
        throw new BadRequestException('Indiquez le motif du refus (5 caractères au moins) : il sera envoyé au vendeur');
      }
    }

    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data:
        decision === 'approve'
          ? { reviewStatus: 'approved', isActive: true, reviewedAt: new Date(), reviewNote: null }
          : { reviewStatus: 'rejected', isActive: false, reviewedAt: new Date(), reviewNote: note!.trim() },
      include: REVIEW_INCLUDE,
    });
    this.logger.log(`Produit ${product.slug} : ${decision === 'approve' ? 'validé' : 'refusé'} par l'administrateur`);
    await this.emailService.sendSellerProductReview(
      seller.email,
      seller.firstName,
      product.name,
      decision === 'approve' ? 'approved' : 'rejected',
      updated.reviewNote,
    );
    return this.toAdminView(updated);
  }

  /** Relance l'analyse d'un fichier dont l'analyse a échoué (antivirus indisponible). */
  async rescan(productId: string) {
    const product = await this.find(productId);
    if (!product.filePath) {
      throw new NotFoundException("Ce produit n'a pas de fichier");
    }
    if (product.scanStatus === 'clean') {
      throw new ConflictException('Ce fichier a déjà été analysé : il est sain');
    }
    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: { scanStatus: 'pending', scanResult: null, scannedAt: null },
      include: REVIEW_INCLUDE,
    });
    await this.antivirusService.enqueue(product.id, product.filePath);
    return this.toAdminView(updated);
  }

  private async find(productId: string): Promise<ReviewRecord> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: { not: null } },
      include: REVIEW_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException('Produit de vendeur introuvable');
    }
    return product;
  }

  private sign(key: string) {
    return this.fileStorageService.getPresignedUrl(key, IMAGE_URL_TTL);
  }

  private async toAdminView(product: ReviewRecord) {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      price: product.price,
      originalPrice: product.originalPrice,
      categoryName: product.category?.name ?? null,
      platform: product.platform,
      version: product.version,
      tags: product.tags,
      demoVideoUrl: product.demoVideoUrl,
      coverUrl: product.coverImageUrl ? await this.sign(product.coverImageUrl) : null,
      screenshotUrls: await Promise.all(product.screenshots.map((key) => this.sign(key))),
      file: product.filePath
        ? {
            name: product.filePath.split('/').pop() ?? '',
            sizeMb: product.fileSizeMb !== null ? Number(product.fileSizeMb) : null,
            sha256: product.fileHash,
          }
        : null,
      scanStatus: product.scanStatus,
      scanResult: product.scanResult,
      scannedAt: product.scannedAt,
      reviewStatus: product.reviewStatus,
      reviewNote: product.reviewNote,
      submittedAt: product.submittedAt,
      reviewedAt: product.reviewedAt,
      isActive: product.isActive,
      store: { name: product.store!.name, slug: product.store!.slug },
      seller: product.store!.seller,
    };
  }
}
