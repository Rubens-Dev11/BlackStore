import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    return {
      revenue: 0,
      orders: 0,
      conversionRate: 0,
    };
  }

  async getAnalytics() {
    return {
      trafficSources: [],
      topProducts: [],
    };
  }

  async getSalesChart(period: string, groupBy: string) {
    return [];
  }
}
