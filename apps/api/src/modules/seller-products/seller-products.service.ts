import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import { PrismaService } from '@/prisma';
import { FileStorageService } from '../file-storage/file-storage.service';
import { detectImageType } from '../file-storage/image-type';
import { ProductsService } from '../products/products.service';
import { AntivirusService } from '../antivirus/antivirus.service';
import { CreateSellerProductDto, UpdateSellerProductDto } from './dto/seller-product.dto';
import {
  decodeUploadName,
  fileExtension,
  safeFileName,
  SELLER_FILE_EXTENSIONS,
  SELLER_FILE_FORMATS_MESSAGE,
  SELLER_SCREENSHOTS_MAX,
} from './seller-files';
import 'multer';

const IMAGE_URL_TTL = 7 * 24 * 3600;

/** Ce qu'il faut charger pour présenter un produit au vendeur. */
const SELLER_PRODUCT_INCLUDE = {
  store: { select: { id: true, sellerId: true, seller: { select: { status: true } } } },
  category: { select: { id: true, name: true } },
  _count: { select: { orderItems: true } },
} satisfies Prisma.ProductInclude;

type SellerProductRecord = Prisma.ProductGetPayload<{ include: typeof SELLER_PRODUCT_INCLUDE }>;

/** Produits des vendeurs : brouillon, envoi des fichiers, soumission, publication. */
@Injectable()
export class SellerProductsService {
  private readonly logger = new Logger(SellerProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly productsService: ProductsService,
    private readonly antivirusService: AntivirusService,
    private readonly configService: ConfigService,
  ) {}

  // ── Lecture ─────────────────────────────────────────────────────────

  async list(sellerId: string) {
    const products = await this.prisma.product.findMany({
      where: { store: { sellerId } },
      orderBy: { createdAt: 'desc' },
      include: SELLER_PRODUCT_INCLUDE,
    });
    return Promise.all(products.map((p) => this.toSellerView(p)));
  }

  async get(sellerId: string, productId: string) {
    return this.toSellerView(await this.ownProduct(sellerId, productId));
  }

  // ── Création et modification ────────────────────────────────────────

  async create(sellerId: string, dto: CreateSellerProductDto) {
    const store = await this.prisma.store.findUnique({ where: { sellerId } });
    if (!store) {
      throw new ConflictException("Créez d'abord votre boutique");
    }
    await this.assertCategory(dto.categoryId);
    SellerProductsService.assertPrices(dto.price, dto.originalPrice ?? null);

    const product = await this.withUniqueSlug(dto.name, (slug) =>
      this.prisma.product.create({
        data: {
          name: dto.name,
          slug,
          shortDescription: dto.shortDescription ?? null,
          description: dto.description ?? null,
          price: dto.price,
          originalPrice: dto.originalPrice ?? null,
          categoryId: dto.categoryId,
          platform: dto.platform ?? 'multiplatform',
          version: dto.version ?? null,
          tags: dto.tags ?? [],
          demoVideoUrl: dto.demoVideoUrl ?? null,
          storeId: store.id,
          reviewStatus: 'draft',
          isActive: false,
        },
        include: SELLER_PRODUCT_INCLUDE,
      }),
    );
    this.logger.log(`Produit vendeur créé : ${product.slug} (boutique ${store.slug})`);
    return this.toSellerView(product);
  }

  async update(sellerId: string, productId: string, dto: UpdateSellerProductDto) {
    const product = await this.ownProduct(sellerId, productId);
    if (dto.categoryId) {
      await this.assertCategory(dto.categoryId);
    }
    SellerProductsService.assertPrices(
      dto.price ?? product.price,
      dto.originalPrice !== undefined ? dto.originalPrice : product.originalPrice,
    );

    const data: Prisma.ProductUpdateInput = {
      name: dto.name,
      shortDescription: dto.shortDescription,
      description: dto.description,
      price: dto.price,
      originalPrice: dto.originalPrice,
      category: dto.categoryId ? { connect: { id: dto.categoryId } } : undefined,
      platform: dto.platform,
      version: dto.version,
      tags: dto.tags,
      demoVideoUrl: dto.demoVideoUrl,
    };

    // L'adresse suit le nom tant que le produit n'a jamais été publié ; ensuite elle ne bouge plus
    // (les liens déjà partagés restent valables).
    const renamed = dto.name !== undefined && dto.name !== product.name && product.reviewStatus !== 'approved';
    const updated = renamed
      ? await this.withUniqueSlug(
          dto.name!,
          (slug) => this.prisma.product.update({ where: { id: productId }, data: { ...data, slug }, include: SELLER_PRODUCT_INCLUDE }),
          productId,
        )
      : await this.prisma.product.update({ where: { id: productId }, data, include: SELLER_PRODUCT_INCLUDE });
    return this.toSellerView(updated);
  }

  // ── Fichiers ────────────────────────────────────────────────────────

  /**
   * Fichier du produit, reçu sur le disque (jamais entier en mémoire), puis envoyé au
   * stockage et analysé par l'antivirus en arrière-plan. Le fichier temporaire est
   * toujours supprimé, même en cas d'erreur.
   */
  async uploadFile(sellerId: string, productId: string, file?: Express.Multer.File) {
    try {
      if (!file) {
        throw new BadRequestException('Aucun fichier reçu');
      }
      const product = await this.ownProduct(sellerId, productId);
      const originalName = decodeUploadName(file.originalname);
      const extension = fileExtension(originalName);
      if (!extension) {
        throw new BadRequestException(`Le fichier doit avoir une extension (.pdf, .zip…). ${SELLER_FILE_FORMATS_MESSAGE}`);
      }
      if (!SELLER_FILE_EXTENSIONS.has(extension)) {
        throw new BadRequestException(`Format .${extension} non accepté. ${SELLER_FILE_FORMATS_MESSAGE}`);
      }
      if (file.size === 0) {
        throw new BadRequestException('Le fichier est vide');
      }

      const { objectKey, sha256, sizeBytes } = await this.fileStorageService.uploadProductFileFromDisk(
        file.path,
        product.id,
        safeFileName(originalName),
      );
      const updated = await this.prisma.product.update({
        where: { id: product.id },
        data: {
          filePath: objectKey,
          fileHash: sha256,
          fileSizeMb: Math.max(0.01, Math.round((sizeBytes / 1024 / 1024) * 100) / 100),
          scanStatus: 'pending',
          scanResult: null,
          scannedAt: null,
        },
        include: SELLER_PRODUCT_INCLUDE,
      });
      if (product.filePath) {
        await this.fileStorageService.removeObject(product.filePath);
      }
      await this.antivirusService.enqueue(product.id, objectKey);
      return this.toSellerView(updated);
    } finally {
      if (file?.path) {
        await fs.promises.unlink(file.path).catch(() => undefined);
      }
    }
  }

  async uploadCover(sellerId: string, productId: string, file?: Express.Multer.File) {
    const mimeType = SellerProductsService.checkImage(file, 'La couverture');
    const product = await this.ownProduct(sellerId, productId);
    const key = await this.fileStorageService.uploadCoverImage(file!.buffer, product.id, mimeType);
    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: { coverImageUrl: key },
      include: SELLER_PRODUCT_INCLUDE,
    });
    if (product.coverImageUrl) {
      await this.fileStorageService.removeObject(product.coverImageUrl);
    }
    return this.toSellerView(updated);
  }

  /** Remplace toutes les captures d'écran du produit. */
  async uploadScreenshots(sellerId: string, productId: string, files: Express.Multer.File[] = []) {
    if (files.length === 0) {
      throw new BadRequestException('Aucune image reçue');
    }
    if (files.length > SELLER_SCREENSHOTS_MAX) {
      throw new BadRequestException(`${SELLER_SCREENSHOTS_MAX} captures d'écran au maximum`);
    }
    const types = files.map((file, i) => SellerProductsService.checkImage(file, `La capture n° ${i + 1}`));
    const product = await this.ownProduct(sellerId, productId);

    const keys: string[] = [];
    for (const [i, file] of files.entries()) {
      keys.push(await this.fileStorageService.uploadScreenshot(file.buffer, product.id, i + 1, types[i]));
    }
    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: { screenshots: keys },
      include: SELLER_PRODUCT_INCLUDE,
    });
    await Promise.all(product.screenshots.map((key) => this.fileStorageService.removeObject(key)));
    return this.toSellerView(updated);
  }

  // ── Soumission et publication ───────────────────────────────────────

  /**
   * Envoi pour validation. Le premier produit d'un vendeur est validé par l'administrateur ;
   * ensuite, un vendeur validé publie directement, sauf un produit déjà refusé.
   */
  async submit(sellerId: string, productId: string) {
    const product = await this.ownProduct(sellerId, productId);
    if (product.reviewStatus === 'pending') {
      throw new ConflictException('Ce produit est déjà en attente de validation');
    }
    if (product.reviewStatus === 'approved') {
      throw new ConflictException('Ce produit est déjà validé');
    }

    const missing: string[] = [];
    if ((product.description?.trim().length ?? 0) < 30) missing.push("une description d'au moins 30 caractères");
    if (!product.categoryId) missing.push('une catégorie');
    if (!product.coverImageUrl) missing.push('une image de couverture');
    if (!product.filePath) missing.push('le fichier du produit');
    if (missing.length > 0) {
      throw new BadRequestException(`Pour soumettre ce produit, ajoutez ${missing.join(', ')}.`);
    }
    if (product.scanStatus === 'pending') {
      throw new ConflictException("L'analyse antivirus de votre fichier n'est pas terminée. Réessayez dans un instant.");
    }
    if (product.scanStatus !== 'clean') {
      throw new ConflictException("Votre fichier n'a pas passé l'analyse antivirus : envoyez une version saine.");
    }
    SellerProductsService.assertPrices(product.price, product.originalPrice);

    // Un produit refusé (ou retiré du site) repasse toujours par l'administrateur.
    const trusted =
      product.reviewStatus !== 'rejected' &&
      product.store!.seller.status === 'approved' &&
      (await this.prisma.product.count({
        where: { storeId: product.storeId, reviewStatus: 'approved', id: { not: product.id } },
      })) > 0;
    const now = new Date();
    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: trusted
        ? { reviewStatus: 'approved', isActive: true, submittedAt: now, reviewedAt: now, reviewNote: null }
        : { reviewStatus: 'pending', submittedAt: now, reviewNote: null },
      include: SELLER_PRODUCT_INCLUDE,
    });
    this.logger.log(`Produit ${product.slug} ${trusted ? 'publié directement' : 'soumis pour validation'}`);
    return this.toSellerView(updated);
  }

  /** Afficher ou masquer un produit validé (sans repasser par la validation). */
  async setVisibility(sellerId: string, productId: string, isActive: boolean) {
    const product = await this.ownProduct(sellerId, productId);
    if (product.reviewStatus !== 'approved') {
      throw new ConflictException('Seul un produit validé peut être affiché ou masqué');
    }
    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: { isActive },
      include: SELLER_PRODUCT_INCLUDE,
    });
    return this.toSellerView(updated);
  }

  /** Suppression définitive, seulement pour un produit jamais commandé. */
  async remove(sellerId: string, productId: string) {
    const product = await this.ownProduct(sellerId, productId);
    if (product._count.orderItems > 0) {
      throw new ConflictException('Ce produit a déjà été commandé : masquez-le plutôt que de le supprimer.');
    }
    await this.prisma.$transaction([
      this.prisma.review.deleteMany({ where: { productId: product.id } }),
      this.prisma.product.delete({ where: { id: product.id } }),
    ]);
    const keys = [product.filePath, product.coverImageUrl, ...product.screenshots].filter((k): k is string => !!k);
    await Promise.all(keys.map((key) => this.fileStorageService.removeObject(key)));
    this.logger.log(`Produit vendeur supprimé : ${product.slug}`);
    return { deleted: true };
  }

  // ── Outils ──────────────────────────────────────────────────────────

  /** Produit du vendeur connecté ; celui d'un autre vendeur est « introuvable ». */
  private async ownProduct(sellerId: string, productId: string): Promise<SellerProductRecord> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, store: { sellerId } },
      include: SELLER_PRODUCT_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }
    return product;
  }

  private async assertCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new BadRequestException('Catégorie introuvable');
    }
  }

  /** Paiement Mobile Money : montant de 100 FCFA au moins, multiple de 5 (ou produit gratuit). */
  static assertPrices(price: number, originalPrice: number | null): void {
    if (price !== 0 && (price < 100 || price % 5 !== 0)) {
      throw new BadRequestException('Le prix doit être 0 (gratuit) ou au moins 100 FCFA, multiple de 5');
    }
    if (originalPrice !== null && originalPrice <= price) {
      throw new BadRequestException('Le prix barré doit être supérieur au prix de vente');
    }
  }

  private static checkImage(file: Express.Multer.File | undefined, label: string) {
    if (!file) {
      throw new BadRequestException('Aucune image reçue');
    }
    const type = detectImageType(file.buffer);
    if (!type) {
      throw new BadRequestException(`${label} doit être une image JPG, PNG ou WebP`);
    }
    return type;
  }

  /** Crée ou renomme avec une adresse libre ; une collision simultanée relance avec un suffixe. */
  private async withUniqueSlug<T>(name: string, write: (slug: string) => Promise<T>, productId?: string): Promise<T> {
    let slug = await this.productsService.generateUniqueSlug(name, productId);
    for (let attempt = 0; ; attempt++) {
      try {
        return await write(slug);
      } catch (error) {
        const slugTaken =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          String(error.meta?.target).includes('slug');
        if (!slugTaken || attempt >= 2) throw error;
        slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      }
    }
  }

  private sign(key: string) {
    return this.fileStorageService.getPresignedUrl(key, IMAGE_URL_TTL);
  }

  private async toSellerView(product: SellerProductRecord) {
    const storefront = this.configService.get<string>('STOREFRONT_URL', 'http://localhost:3001').replace(/\/+$/, '');
    const isPublic =
      product.isActive &&
      product.reviewStatus === 'approved' &&
      product.scanStatus === 'clean' &&
      product.store?.seller.status === 'approved';
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      price: product.price,
      originalPrice: product.originalPrice,
      categoryId: product.categoryId,
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
          }
        : null,
      scanStatus: product.scanStatus,
      // Nom de la menace détectée ; le détail d'une panne d'analyse reste réservé à l'administrateur.
      scanThreat: product.scanStatus === 'infected' ? product.scanResult : null,
      reviewStatus: product.reviewStatus,
      reviewNote: product.reviewNote,
      submittedAt: product.submittedAt,
      reviewedAt: product.reviewedAt,
      isActive: product.isActive,
      isPublic,
      publicUrl: `${storefront}/produits/${product.slug}`,
      orderCount: product._count.orderItems,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
