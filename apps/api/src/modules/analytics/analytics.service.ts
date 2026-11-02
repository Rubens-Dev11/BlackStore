import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma';
import { Request } from 'express';
import * as crypto from 'crypto';
import { TrackPageviewDto } from './dto/track-pageview.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  /**
   * Clé secrète du hachage des adresses IP : sans elle, une empreinte SHA-256 nue se retrouverait en
   * essayant toutes les adresses IPv4. Tirée du secret des jetons, propre au serveur.
   */
  private readonly ipKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.ipKey = crypto
      .createHash('sha256')
      .update(`page-views:${configService.get<string>('JWT_SECRET') ?? ''}`)
      .digest();
  }

  async trackPageView(
    dto: TrackPageviewDto | undefined,
    req: Request,
    ip: string,
  ): Promise<{ success: boolean }> {
    try {
      const ipHash = crypto.createHmac('sha256', this.ipKey).update(ip || '').digest('hex');
      const userAgent = req.headers['user-agent'] ?? null;
      const data = dto ?? {};
      const storeId = data.storeSlug
        ? (await this.prisma.store.findUnique({ where: { slug: data.storeSlug }, select: { id: true } }))?.id
        : undefined;
      if (!data.productId && !storeId) {
        return { success: true };
      }

      await this.prisma.pageView.create({
        data: {
          productId: data.productId,
          storeId: data.productId ? undefined : storeId,
          sessionId: data.sessionId,
          utmSource: data.utmSource?.trim().toLowerCase() || undefined,
          utmMedium: data.utmMedium?.trim().toLowerCase() || undefined,
          referrerHost: data.referrerHost?.replace(/^www\./, ''),
          ipHash,
          userAgent,
        },
      });

      this.logger.log(
        `PageView enregistrée — ${data.productId ? `produit ${data.productId}` : `boutique ${data.storeSlug}`}, source: ${data.utmSource ?? data.referrerHost ?? 'directe'}`,
      );
    } catch (error) {
      this.logger.error('Échec enregistrement PageView (non-bloquant)', error);
    }

    return { success: true };
  }
}
