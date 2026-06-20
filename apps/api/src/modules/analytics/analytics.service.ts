import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma';
import { Request } from 'express';
import * as crypto from 'crypto';
import { TrackPageviewDto } from './dto/track-pageview.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async trackPageView(
    dto: TrackPageviewDto | undefined,
    req: Request,
    ip: string,
  ): Promise<{ success: boolean }> {
    try {
      const ipHash = crypto.createHash('sha256').update(ip || '').digest('hex');
      const userAgent = req.headers['user-agent'] ?? null;
      const data = dto ?? {};

      await this.prisma.pageView.create({
        data: {
          productId: data.productId,
          sessionId: data.sessionId,
          utmSource: data.utmSource,
          utmMedium: data.utmMedium,
          ipHash,
          userAgent,
        },
      });

      this.logger.log(
        `PageView enregistrée — productId: ${data.productId ?? 'n/a'}, session: ${data.sessionId ?? 'n/a'}, source: ${data.utmSource ?? 'n/a'}`,
      );
    } catch (error) {
      this.logger.error('Échec enregistrement PageView (non-bloquant)', error);
    }

    return { success: true };
  }
}
