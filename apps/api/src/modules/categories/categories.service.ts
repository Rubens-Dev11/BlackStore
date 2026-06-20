import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) { }

  async findAll() {
    return await this.prisma.category.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Catégorie introuvable');
    }

    return category;
  }

  async create(createCategoryDto: CreateCategoryDto) {
    const slug = this.generateSlug(createCategoryDto.name);

    return await this.prisma.category.create({
      data: {
        name: createCategoryDto.name,
        slug,
        description: createCategoryDto.description,
        iconUrl: createCategoryDto.imageUrl,
      },
    });
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    let slug = category.slug;
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      slug = this.generateSlug(updateCategoryDto.name);
    }

    return await this.prisma.category.update({
      where: { id },
      data: {
        name: updateCategoryDto.name,
        slug,
        description: updateCategoryDto.description,
        iconUrl: updateCategoryDto.imageUrl,
      },
    });
  }

  async remove(id: string) {
    const category = await this.findOne(id);

    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      throw new ConflictException(
        'Impossible de supprimer la catégorie car elle contient des produits',
      );
    }

    return await this.prisma.category.delete({
      where: { id },
    });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}