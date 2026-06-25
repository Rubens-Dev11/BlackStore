import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma';
import { FileStorageService } from '../file-storage/file-storage.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import 'multer';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
  ) { }

  async findAll(query: ProductQueryDto) {
    const { page = 1, limit = 12, categoryId, featured } = query;

    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (featured) where.isFeatured = featured;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          price: true,
          version: true,
          isFeatured: true,
          viewCount: true,
          createdAt: true,
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllAdmin() {
    const data = await this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      data,
      total: data.length,
      page: 1,
      limit: data.length,
      totalPages: 1,
    };
  }

  async findFeatured() {
    return await this.prisma.product.findMany({
      where: { isFeatured: true, isActive: true },
      take: 8,
      orderBy: { viewCount: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        version: true,
        isFeatured: true,
        viewCount: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  async search(q: string) {
    return await this.prisma.product.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
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
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        version: true,
        isFeatured: true,
        viewCount: true,
        category: {
          select: { id: true, name: true, slug: true },
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

    return product;
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
      },
    });
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.findById(id);

    let slug = product.slug;
    if (updateProductDto.name && updateProductDto.name !== product.name) {
      slug = await this.generateUniqueSlug(updateProductDto.name);
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

  async uploadProductFile(id: string, file: Express.Multer.File) {
    await this.findById(id);

    const { objectKey, sha256, sizeBytes } = await this.fileStorageService.uploadFile(
      file.buffer,
      file.originalname,
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

  private async generateUniqueSlug(name: string): Promise<string> {
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let existing = await this.prisma.product.findUnique({ where: { slug } });
    let suffix = 2;

    while (existing) {
      const newSlug = `${slug}-${suffix}`;
      existing = await this.prisma.product.findUnique({ where: { slug: newSlug } });
      if (!existing) {
        slug = newSlug;
        break;
      }
      suffix++;
    }

    return slug;
  }
}