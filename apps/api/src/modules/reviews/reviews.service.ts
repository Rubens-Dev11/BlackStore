import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma';
import { CreateReviewDto } from './dto/create-review.dto';

export interface ReviewListQuery {
  page?: number;
  limit?: number;
  isApproved?: boolean;
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(productId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Produit introuvable');
    }

    const paidOrder = await this.prisma.order.findFirst({
      where: {
        buyerEmail: dto.buyerEmail,
        status: 'paid',
        items: {
          some: { productId },
        },
      },
      select: { id: true },
    });

    if (!paidOrder) {
      throw new ForbiddenException(
        'Vous devez avoir acheté ce produit pour laisser un avis',
      );
    }

    try {
      const review = await this.prisma.review.create({
        data: {
          productId,
          buyerEmail: dto.buyerEmail,
          rating: dto.rating,
          comment: dto.comment,
          isApproved: false,
        },
      });

      this.logger.log(
        `Avis soumis pour le produit ${productId} par ${dto.buyerEmail} (en attente de modération)`,
      );

      return review;
    } catch (error) {
      this.prisma.handleError(error);
    }
  }

  async findByProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        ratingAvg: true,
        ratingCount: true,
        isActive: true,
      },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Produit introuvable');
    }

    const reviews = await this.prisma.review.findMany({
      where: { productId, isApproved: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        buyerEmail: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    });

    return {
      reviews,
      ratingAvg: product.ratingAvg,
      ratingCount: product.ratingCount,
    };
  }

  async findAll(query: ReviewListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { isApproved } = query;

    const where: Prisma.ReviewWhereInput = {};
    if (isApproved !== undefined) {
      where.isApproved = isApproved;
    }

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: { name: true, slug: true },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async approve(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true, productId: true, isApproved: true },
    });

    if (!review) {
      throw new NotFoundException('Avis introuvable');
    }

    if (review.isApproved) {
      return this.prisma.review.findUnique({
        where: { id },
        include: {
          product: {
            select: { name: true, slug: true },
          },
        },
      });
    }

    try {
      const updatedReview = await this.prisma.review.update({
        where: { id },
        data: { isApproved: true },
        include: {
          product: {
            select: { name: true, slug: true },
          },
        },
      });

      await this.recalculateProductRatings(review.productId);

      this.logger.log(`Avis ${id} approuvé pour le produit ${review.productId}`);

      return updatedReview;
    } catch (error) {
      this.prisma.handleError(error);
    }
  }

  async remove(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true, productId: true },
    });

    if (!review) {
      throw new NotFoundException('Avis introuvable');
    }

    try {
      await this.prisma.review.delete({ where: { id } });
      await this.recalculateProductRatings(review.productId);

      this.logger.log(`Avis ${id} supprimé pour le produit ${review.productId}`);

      return { success: true };
    } catch (error) {
      this.prisma.handleError(error);
    }
  }

  private async recalculateProductRatings(productId: string): Promise<void> {
    const aggregation = await this.prisma.review.aggregate({
      where: { productId, isApproved: true },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        ratingAvg: aggregation._avg.rating ?? 0,
        ratingCount: aggregation._count.rating,
      },
    });
  }
}
