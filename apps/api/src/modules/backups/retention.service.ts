import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma';

/**
 * Suppression des données au-delà des durées annoncées dans la politique de confidentialité :
 * messages de contact traités et signalements traités (2 ans), statistiques de visite (13 mois).
 */
@Injectable()
export class RetentionService {
  constructor(private readonly prisma: PrismaService) {}

  async purge(now = new Date()) {
    const monthsAgo = (months: number) => {
      const date = new Date(now);
      date.setMonth(date.getMonth() - months);
      return date;
    };
    const [messages, reports, pageViews, loginLinks, sessions] = await this.prisma.$transaction([
      this.prisma.supportRequest.deleteMany({ where: { status: { in: ['answered', 'closed'] }, updatedAt: { lt: monthsAgo(24) } } }),
      this.prisma.productReport.deleteMany({ where: { status: { not: 'open' }, resolvedAt: { lt: monthsAgo(24) } } }),
      this.prisma.pageView.deleteMany({ where: { createdAt: { lt: monthsAgo(13) } } }),
      // Espace client : liens de connexion et sessions expirés ne servent plus à rien.
      this.prisma.customerLoginToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.customerSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);
    return {
      messages: messages.count,
      reports: reports.count,
      pageViews: pageViews.count,
      clientAccess: loginLinks.count + sessions.count,
    };
  }
}
