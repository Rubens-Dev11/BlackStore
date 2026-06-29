import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, Product, DownloadToken, OrderStatus } from '@prisma/client';
import { PrismaService } from '@/prisma';
import { EmailService } from '../email/email.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async create(createOrderDto: CreateOrderDto) {
    const { items, ...orderData } = createOrderDto;

    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) }, isActive: true },
    });

    if (products.length !== items.length) {
      throw new ConflictException('Un ou plusieurs produits sont introuvables ou inactifs');
    }

    // Chaque OrderItem = 1 unité. Si quantity > 1, on crée plusieurs OrderItem.
    const orderItemsData: { productId: string; priceAtPurchase: number }[] = [];
    for (const item of items) {
      const product = products.find((p: Product) => p.id === item.productId);
      if (!product) {
        throw new ConflictException(`Produit introuvable : ${item.productId}`);
      }
      for (let i = 0; i < item.quantity; i++) {
        orderItemsData.push({ productId: item.productId, priceAtPurchase: product.price });
      }
    }

    const totalAmount = orderItemsData.reduce((sum, item) => sum + item.priceAtPurchase, 0);

    const orderNumber = `BS-2026-${Math.floor(10000 + Math.random() * 90000)}`;

    const order = await this.prisma.$transaction(async (prisma: Prisma.TransactionClient) => {
      const createdOrder = await prisma.order.create({
        data: {
          orderNumber,
          totalAmount,
          status: 'pending',
          buyerName: orderData.customerName,
          buyerEmail: orderData.customerEmail,
          buyerPhone: orderData.customerPhone,
          utmSource: orderData.utm_source,
          utmMedium: orderData.utm_medium,
          utmCampaign: orderData.utm_campaign,
          utmContent: orderData.utm_content,
          referrerUrl: orderData.referrer_url,
        },
      });

      await prisma.orderItem.createMany({
        data: orderItemsData.map((item) => ({
          orderId: createdOrder.id,
          productId: item.productId,
          priceAtPurchase: item.priceAtPurchase,
        })),
      });

      return createdOrder;
    });

    this.logger.log(`Commande créée : ${order.id} — ${orderNumber}`);
    return this.findOne(order.id);
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { status, dateFrom, dateTo } = query;

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status as OrderStatus;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }

    return order;
  }

  async refund(id: string) {
    const order = await this.findOne(id);

    if (order.status !== 'paid') {
      throw new ConflictException('Seules les commandes payées peuvent être remboursées');
    }

    return await this.prisma.order.update({
      where: { id },
      data: { status: 'refunded' },
    });
  }

  async resendDownload(id: string) {
    const order = await this.findOne(id);

    if (order.status !== 'paid') {
      throw new ConflictException(
        'Seules les commandes payées peuvent recevoir des liens de téléchargement',
      );
    }

    const downloadTokens = await this.prisma.downloadToken.findMany({
      where: { orderItem: { orderId: id } },
      include: { orderItem: { include: { product: true } } },
    });

    if (downloadTokens.length === 0) {
      throw new ConflictException('Aucun lien de téléchargement trouvé pour cette commande');
    }

    const products = await Promise.all(
      downloadTokens.map(
        async (token: DownloadToken & { orderItem: { product: Product } }) => ({
          name: token.orderItem.product.name,
          downloadLink: await this.fileStorageService.getPresignedUrl(
            token.orderItem.product.filePath ?? '',
            900,
          ),
          expiry: token.expiresAt.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        }),
      ),
    );

    const downloadLinks = products.map((p) => p.downloadLink);

    await this.emailService.sendDownloadEmail(
      order.buyerEmail,
      order.buyerName,
      products,
      downloadLinks,
    );

    this.logger.log(`Liens de téléchargement renvoyés pour la commande : ${order.id}`);
    return { success: true };
  }

  async findByNumberPublic(orderNumber: string, email: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber,
        buyerEmail: email.toLowerCase().trim(),
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, slug: true, coverImageUrl: true },
            },
            downloadTokens: {
              where: { isActive: true },
              select: {
                token: true,
                downloadCount: true,
                maxDownloads: true,
                expiresAt: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        'Commande introuvable. Vérifiez le numéro et l\'adresse email.',
      );
    }

    return order;
  }

  async exportCsv(): Promise<string> {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        orderNumber: true,
        buyerName: true,
        buyerEmail: true,
        buyerPhone: true,
        totalAmount: true,
        status: true,
        paymentMethod: true,
        createdAt: true,
      },
    });

    const headers = [
      'Numéro',
      'Acheteur',
      'Email',
      'Téléphone',
      'Montant (FCFA)',
      'Statut',
      'Méthode paiement',
      'Date',
    ];

    const rows = orders.map((order) =>
      [
        order.orderNumber,
        order.buyerName,
        order.buyerEmail,
        order.buyerPhone ?? '',
        order.totalAmount,
        order.status,
        order.paymentMethod ?? '—',
        order.createdAt.toISOString(),
      ]
        .map((field) => this.escapeCsvField(field))
        .join(','),
    );

    this.logger.log(`Export CSV commandes — ${orders.length} ligne(s)`);

    return [headers.join(','), ...rows].join('\n');
  }

  private escapeCsvField(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
