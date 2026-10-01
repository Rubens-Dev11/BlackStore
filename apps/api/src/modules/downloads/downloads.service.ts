import { Injectable, Logger, NotFoundException, GoneException, ForbiddenException, ConflictException } from '@nestjs/common';
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

    // Fichier d'un vendeur : servi seulement après l'antivirus (un fichier remplacé est réanalysé).
    const product = downloadToken.orderItem.product;
    if (!product.filePath) {
      throw new NotFoundException('Fichier indisponible');
    }
    if (product.storeId && product.scanStatus !== 'clean') {
      throw new ConflictException('Ce fichier est en cours de vérification. Réessayez dans quelques minutes.');
    }

    const ipHash = crypto.createHash('sha256').update(req.ip || '').digest('hex');

    this.logger.log(`Téléchargement initié — Token: ${token}, IP: ${ipHash}, Product: ${downloadToken.orderItem.productId}`);

    await this.prisma.downloadToken.update({
      where: { id: downloadToken.id },
      data: { downloadCount: downloadToken.downloadCount + 1 },
    });

    // Extract the actual filename from filePath
    const filePath = downloadToken.orderItem.product.filePath || '';
    const fileName = filePath.split('/').pop() || downloadToken.orderItem.product.name;

    const presignedUrl = await this.fileStorageService.getPresignedUrl(
      filePath,
      3600,
      {
        'response-content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'response-content-type': 'application/octet-stream',
      },
    );

    return {
      presignedUrl,
      fileName: downloadToken.orderItem.product.name, // Keep original product name for response? The spec expects product.name? We'll keep as before.
      mimeType: 'application/octet-stream',
    };
  }
}
