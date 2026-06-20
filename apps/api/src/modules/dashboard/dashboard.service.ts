import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma';

export interface ExportOrdersQuery {
  dateFrom?: Date;
  dateTo?: Date;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      revenueAggregate,
      totalOrders,
      paidOrders,
      totalProducts,
      pendingReviews,
      revenueLast30DaysAggregate,
      ordersLast30Days,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: { status: 'paid' },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'paid' } }),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.review.count({ where: { isApproved: false } }),
      this.prisma.order.aggregate({
        where: {
          status: 'paid',
          paidAt: { gte: thirtyDaysAgo },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    const conversionRate =
      totalOrders === 0
        ? 0
        : Math.round((paidOrders / totalOrders) * 10000) / 100;

    return {
      totalRevenue: revenueAggregate._sum.totalAmount ?? 0,
      totalOrders,
      paidOrders,
      conversionRate,
      totalProducts,
      pendingReviews,
      revenueLast30Days: revenueLast30DaysAggregate._sum.totalAmount ?? 0,
      ordersLast30Days,
    };
  }

  async getAnalytics() {
    const [trafficGroups, productViewGroups, totalProductViews, totalOrders, paidOrders] =
      await Promise.all([
        this.prisma.pageView.groupBy({
          by: ['utmSource'],
          where: { utmSource: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        this.prisma.pageView.groupBy({
          by: ['productId'],
          where: { productId: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        this.prisma.pageView.count({ where: { productId: { not: null } } }),
        this.prisma.order.count(),
        this.prisma.order.count({ where: { status: 'paid' } }),
      ]);

    const productIds = productViewGroups
      .map((group) => group.productId)
      .filter((id): id is string => id !== null);

    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true },
        })
      : [];

    const productNameById = new Map(products.map((product) => [product.id, product.name]));

    return {
      trafficSources: trafficGroups.map((group) => ({
        utmSource: group.utmSource,
        count: group._count.id,
      })),
      topProductsByViews: productViewGroups.map((group) => ({
        productId: group.productId,
        productName: group.productId ? productNameById.get(group.productId) ?? null : null,
        viewCount: group._count.id,
      })),
      conversionFunnel: {
        productViews: totalProductViews,
        ordersCreated: totalOrders,
        ordersPaid: paidOrders,
      },
    };
  }

  async getSalesChart(days = 30) {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const paidOrders = await this.prisma.order.findMany({
      where: {
        status: 'paid',
        paidAt: { gte: startDate, lte: endDate },
      },
      select: { paidAt: true, totalAmount: true },
    });

    const chartByDate = new Map<string, { revenue: number; ordersCount: number }>();

    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dateKey = cursor.toISOString().slice(0, 10);
      chartByDate.set(dateKey, { revenue: 0, ordersCount: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const order of paidOrders) {
      if (!order.paidAt) {
        continue;
      }
      const dateKey = order.paidAt.toISOString().slice(0, 10);
      const entry = chartByDate.get(dateKey);
      if (entry) {
        entry.revenue += order.totalAmount;
        entry.ordersCount += 1;
      }
    }

    return Array.from(chartByDate.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, stats]) => ({
        date,
        revenue: stats.revenue,
        ordersCount: stats.ordersCount,
      }));
  }

  async exportOrdersCsv(query: ExportOrdersQuery): Promise<string> {
    const where: Prisma.OrderWhereInput = {};

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = query.dateFrom;
      }
      if (query.dateTo) {
        where.createdAt.lte = query.dateTo;
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        orderNumber: true,
        buyerName: true,
        buyerEmail: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        paidAt: true,
      },
    });

    const headers = [
      'orderNumber',
      'buyerName',
      'buyerEmail',
      'totalAmount',
      'status',
      'createdAt',
      'paidAt',
    ];

    const rows = orders.map((order) =>
      [
        order.orderNumber,
        order.buyerName,
        order.buyerEmail,
        order.totalAmount,
        order.status,
        order.createdAt.toISOString(),
        order.paidAt ? order.paidAt.toISOString() : '',
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
