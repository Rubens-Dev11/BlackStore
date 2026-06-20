import { Injectable, Logger, NotFoundException, GoneException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma';
import { FileStorageService } from '../file-storage/file-storage.service';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class DownloadsService {
  private readonly logger = new Logger(DownloadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  /**
   * Stream a file via download token.
   */
  async streamFile(token: string, req: Request) {
    const downloadToken = await this.prisma.downloadToken.findUnique({
      where: { token },
      include: { orderItem: { include: { product: true } } },
    });

    if (!downloadToken) {
      throw new NotFoundException('Lien de téléchargement introuvable');
    }

    if (downloadToken.expiresAt < new Date()) {
      throw new GoneException('Lien expiré');
    }

    if (downloadToken.downloadCount >= downloadToken.maxDownloads) {
      throw new ForbiddenException('Quota de téléchargements atteint');
    }

    const ipHash = crypto.createHash('sha256').update(req.ip || '').digest('hex');

    this.logger.log(`Téléchargement initié — Token: ${token}, IP: ${ipHash}, Product: ${downloadToken.orderItem.productId}`);

    await this.prisma.downloadToken.update({
      where: { id: downloadToken.id },
      data: { downloadCount: downloadToken.downloadCount + 1 },
    });

    const presignedUrl = await this.fileStorageService.getPresignedUrl(
      downloadToken.orderItem.product.filePath || '',
      60,
    );

    return {
      presignedUrl,
      fileName: downloadToken.orderItem.product.name,
      mimeType: 'application/octet-stream',
    };
  }
}
