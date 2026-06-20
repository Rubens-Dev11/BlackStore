import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findProductReviews(productId: string) {
    return [];
  }

  async create(productId: string, data: any) {
    return { id: 'new-review-id', productId, ...data };
  }

  async findAll() {
    return [];
  }

  async approve(id: string, isApproved: boolean) {
    return { id, isApproved };
  }

  async remove(id: string) {
    return { id, deleted: true };
  }
}
