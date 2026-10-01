import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma';
import { FileStorageService } from '../file-storage/file-storage.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { Platform, Prisma } from '@prisma/client';
import 'multer';
import { PUBLIC_PRODUCT_WHERE, plainTextToHtml } from './product-visibility';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
  ) { }

  // Durée de validité des URLs presigned (7 jours = max autorisé par MinIO/S3).
  private static readonly PRESIGN_TTL = 7 * 24 * 3600;

  // Nombre de téléchargements affiché = commandes payées (gratuites comprises)
  // contenant le produit, compté à la lecture. La colonne download_count n'est
  // jamais incrémentée, et les liens envoyés par e-mail pointent directement
  // vers MinIO sans passer par l'API : seules les commandes sont fiables.
  private static readonly PAID_ORDERS_COUNT = {
    select: { orderItems: { where: { order: { status: 'paid' } } } },
  } satisfies Prisma.ProductCountOutputTypeDefaultArgs;

  /** Expose le comptage sous le champ downloadCount lu par la boutique et l'admin. */
  private withDownloadCount<T extends { _count: { orderItems: number } }>({
    _count,
    ...product
  }: T): Omit<T, '_count'> & { downloadCount: number } {
    return { ...product, downloadCount: _count.orderItems };
  }

  /**
   * Transforme les objectKeys MinIO d'un produit en URLs presigned joignables
   * par le navigateur. À défaut de coverImageUrl, utilise le 1er screenshot.
   */
  private async withImageUrls<
    T extends { coverImageUrl?: string | null; screenshots?: string[] | null },
  >(product: T): Promise<T> {
    const sign = (key: string | null | undefined) =>
      key
        ? this.fileStorageService.getPresignedUrl(key, ProductsService.PRESIGN_TTL)
        : Promise.resolve(null);

    const coverKey = product.coverImageUrl || product.screenshots?.[0] || null;
    const [coverImageUrl, screenshots] = await Promise.all([
      sign(coverKey),
      product.screenshots
        ? Promise.all(product.screenshots.map((k) => this.fileStorageService.getPresignedUrl(k, ProductsService.PRESIGN_TTL)))
        : Promise.resolve(product.screenshots ?? undefined),
    ]);

    return { ...product, coverImageUrl, ...(product.screenshots ? { screenshots } : {}) };
  }

  async findAll(query: ProductQueryDto) {
    const { page = 1, limit = 12, categoryId, featured } = query;

    const where: Prisma.ProductWhereInput = { ...PUBLIC_PRODUCT_WHERE };
    if (categoryId) where.categoryId = categoryId;
    if (featured) where.isFeatured = featured;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { isFeatured: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          coverImageUrl: true,
          screenshots: true,
          price: true,
          originalPrice: true,
          platform: true,
          isFeatured: true,
          _count: ProductsService.PAID_ORDERS_COUNT,
          ratingAvg: true,
          ratingCount: true,
          viewCount: true,
          categoryId: true,
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: await Promise.all(data.map((p) => this.withImageUrls(this.withDownloadCount(p)))),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Produits actifs d'une boutique, au même format que le catalogue. */
  async findByStore(storeId: string) {
    const data = await this.prisma.product.findMany({
      where: { storeId, ...PUBLIC_PRODUCT_WHERE },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        coverImageUrl: true,
        screenshots: true,
        price: true,
        originalPrice: true,
        platform: true,
        isFeatured: true,
        _count: ProductsService.PAID_ORDERS_COUNT,
        ratingAvg: true,
        ratingCount: true,
        viewCount: true,
        categoryId: true,
      },
    });
    return Promise.all(data.map((p) => this.withImageUrls(this.withDownloadCount(p))));
  }

  async findAllAdmin() {
    const data = await this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: ProductsService.PAID_ORDERS_COUNT,
        store: { select: { name: true, slug: true } },
      },
    });

    return {
      data: await Promise.all(data.map((p) => this.withImageUrls(this.withDownloadCount(p)))),
      total: data.length,
      page: 1,
      limit: data.length,
      totalPages: 1,
    };
  }

  async findFeatured() {
    const data = await this.prisma.product.findMany({
      where: { isFeatured: true, ...PUBLIC_PRODUCT_WHERE },
      take: 8,
      orderBy: { viewCount: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        coverImageUrl: true,
        screenshots: true,
        price: true,
        originalPrice: true,
        platform: true,
        isFeatured: true,
        _count: ProductsService.PAID_ORDERS_COUNT,
        ratingAvg: true,
        ratingCount: true,
        viewCount: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return await Promise.all(data.map((p) => this.withImageUrls(this.withDownloadCount(p))));
  }

  async search(q: string) {
    return await this.prisma.product.findMany({
      where: {
        AND: [
          PUBLIC_PRODUCT_WHERE,
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
            ],
          },
        ],
      },
      take: 20,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        version: true,
        isFeatured: true,
        viewCount: true,
        platform: true,
        category: {
          select: { id: true, name: true, slug: true },
      },
      },
    });
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, ...PUBLIC_PRODUCT_WHERE },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        coverImageUrl: true,
        screenshots: true,
        demoVideoUrl: true,
        installGuide: true,
        price: true,
        originalPrice: true,
        platform: true,
        version: true,
        fileSizeMb: true,
        minRequirements: true,
        tags: true,
        viewCount: true,
        ratingAvg: true,
        ratingCount: true,
        _count: ProductsService.PAID_ORDERS_COUNT,
        isActive: true,
        isFeatured: true,
        seoTitle: true,
        seoDescription: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        // « Vendu par » : absent pour les produits de BlackStore.
        store: {
          select: { name: true, slug: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }

    await this.prisma.product.update({
      where: { id: product.id },
      data: { viewCount: product.viewCount + 1 },
    });

    // Une description de vendeur est du texte brut : jamais interprétée comme du HTML.
    const description = product.store ? plainTextToHtml(product.description) : product.description;
    return await this.withImageUrls(this.withDownloadCount({ ...product, description }));
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }

    return product;
  }

  async create(createProductDto: CreateProductDto) {
    const slug = await this.generateUniqueSlug(createProductDto.name);

    return await this.prisma.product.create({
      data: {
        name: createProductDto.name,
        slug,
        description: createProductDto.description,
        price: createProductDto.price,
        categoryId: createProductDto.categoryId,
        version: createProductDto.version,
        maxDownloads: createProductDto.downloadLimit || 3,
        downloadExpiryHours: createProductDto.downloadExpiryHours || 72,
        isFeatured: createProductDto.isFeatured || false,
        platform: createProductDto.platform || Platform.android,
      },
    });
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.findById(id);

    let slug = product.slug;
    if (updateProductDto.name && updateProductDto.name !== product.name) {
      slug = await this.generateUniqueSlug(updateProductDto.name, id);
    }

    return await this.prisma.product.update({
      where: { id },
      data: {
        name: updateProductDto.name,
        slug,
        description: updateProductDto.description,
        price: updateProductDto.price,
        categoryId: updateProductDto.categoryId,
        version: updateProductDto.version,
        maxDownloads: updateProductDto.downloadLimit,
        downloadExpiryHours: updateProductDto.downloadExpiryHours,
        isFeatured: updateProductDto.isFeatured,
        isActive: updateProductDto.isActive,
        ...(updateProductDto.platform !== undefined && { platform: updateProductDto.platform }),
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);

    return await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async uploadFile(id: string, file: Express.Multer.File) {
    await this.findById(id);

    const objectName = `products/${id}/${file.originalname}`;

    const { objectKey, sha256, sizeBytes } = await this.fileStorageService.uploadFile(
      file.buffer,
      objectName,
      file.mimetype,
    );

    return await this.prisma.product.update({
      where: { id },
      data: {
        filePath: objectKey,
        fileSizeMb: Math.round(sizeBytes / 1024 / 1024),
        fileHash: sha256,
      },
    });
  }

  async uploadScreenshots(id: string, files: Express.Multer.File[]) {
    await this.findById(id);

    const screenshots: string[] = [];
    for (let i = 0; i < Math.min(files.length, 8); i++) {
      const objectKey = await this.fileStorageService.uploadScreenshot(
        files[i].buffer,
        id,
        i + 1,
      );
      screenshots.push(objectKey);
    }

    return await this.prisma.product.update({
      where: { id },
      data: { screenshots },
    });
  }

  async uploadCoverImage(id: string, file: Express.Multer.File) {
    await this.findById(id);

    const objectKey = await this.fileStorageService.uploadCoverImage(
      file.buffer,
      id,
      file.mimetype,
    );

    return await this.prisma.product.update({
      where: { id },
      data: { coverImageUrl: objectKey },
    });
  }

  /** Adresse libre tirée du nom ; celle du produit ignoreProductId (renommage) compte comme libre. */
  async generateUniqueSlug(name: string, ignoreProductId?: string): Promise<string> {
    // « Créations Numériques » → « creations-numeriques » (accents retirés plutôt que remplacés par des tirets).
    let slug = name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 80)
      .replace(/^-+|-+$/g, '') || 'produit';

    const taken = async (candidate: string) => {
      const found = await this.prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
      return !!found && found.id !== ignoreProductId;
    };
    let existing = await taken(slug);
    let suffix = 2;

    while (existing) {
      const newSlug = `${slug}-${suffix}`;
      existing = await taken(newSlug);
      if (!existing) {
        slug = newSlug;
        break;
      }
      suffix++;
    }

    return slug;
  }
}
