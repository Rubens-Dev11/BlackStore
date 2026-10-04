import { Injectable, Logger, NotFoundException, GoneException, ForbiddenException, ConflictException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma';
import { FileStorageService } from '../file-storage/file-storage.service';
import { Request } from 'express';
import * as crypto from 'crypto';

/**
 * État d'un lien de téléchargement, affiché au client par la page
 * /telechargement/<jeton> de la boutique quand le lien ne marche pas.
 */
export type DownloadState =
  | 'valide'
  | 'introuvable'
  | 'annule' // lien désactivé, ou commande remboursée / non payée
  | 'expire'
  | 'quota'
  | 'verification' // fichier d'un vendeur en cours d'analyse antivirus
  | 'indisponible'; // fichier absent ou refusé par l'antivirus

export interface DownloadStatus {
  etat: DownloadState;
  produit?: string;
  commande?: string;
  expireLe?: string;
  telechargementsRestants?: number;
  telechargementsMax?: number;
}

/** Erreur renvoyée aux appels techniques (les navigateurs sont redirigés vers la page explicative). */
const STATE_ERRORS: Record<Exclude<DownloadState, 'valide'>, () => HttpException> = {
  introuvable: () => new NotFoundException('Lien de téléchargement introuvable'),
  annule: () => new GoneException('Ce lien n’est plus valable : la commande a été remboursée ou n’est pas payée'),
  expire: () => new GoneException('Lien expiré'),
  quota: () => new ForbiddenException('Quota de téléchargements atteint'),
  verification: () => new ConflictException('Ce fichier est en cours de vérification. Réessayez dans quelques minutes.'),
  indisponible: () => new NotFoundException('Fichier indisponible'),
};

const tokenInclude = {
  orderItem: { include: { product: true, order: { select: { status: true, orderNumber: true } } } },
} as const;

@Injectable()
export class DownloadsService {
  private readonly logger = new Logger(DownloadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly configService: ConfigService,
  ) {}

  private findToken(token: string) {
    // Les jetons sont des UUID : inutile d'interroger la base pour une valeur fantaisiste.
    if (!token || token.length > 64) return Promise.resolve(null);
    return this.prisma.downloadToken.findUnique({ where: { token }, include: tokenInclude });
  }

  private stateOf(downloadToken: Awaited<ReturnType<DownloadsService['findToken']>>): DownloadState {
    if (!downloadToken) return 'introuvable';
    // Lien désactivé, ou commande remboursée (ou jamais payée) : il ne sert plus.
    if (!downloadToken.isActive || downloadToken.orderItem.order.status !== 'paid') return 'annule';
    if (downloadToken.expiresAt < new Date()) return 'expire';
    if (downloadToken.downloadCount >= downloadToken.maxDownloads) return 'quota';
    // Fichier d'un vendeur : servi seulement après l'antivirus (un fichier remplacé est réanalysé).
    const product = downloadToken.orderItem.product;
    if (!product.filePath) return 'indisponible';
    if (product.storeId && product.scanStatus !== 'clean') {
      return product.scanStatus === 'pending' ? 'verification' : 'indisponible';
    }
    return 'valide';
  }

  /** État d'un lien, pour la page explicative de la boutique (aucun téléchargement compté). */
  async status(token: string): Promise<DownloadStatus> {
    const downloadToken = await this.findToken(token);
    const etat = this.stateOf(downloadToken);
    if (!downloadToken) return { etat };
    return {
      etat,
      produit: downloadToken.orderItem.product.name,
      commande: downloadToken.orderItem.order.orderNumber,
      expireLe: downloadToken.expiresAt.toISOString(),
      telechargementsRestants: Math.max(0, downloadToken.maxDownloads - downloadToken.downloadCount),
      telechargementsMax: downloadToken.maxDownloads,
    };
  }

  /** Page de la boutique qui explique pourquoi un lien ne marche pas et que faire. */
  errorPageUrl(token: string): string {
    const storefront = this.configService.get<string>('STOREFRONT_URL', 'http://localhost:3001').replace(/\/+$/, '');
    return `${storefront}/telechargement/${encodeURIComponent(token)}`;
  }

  /**
   * Stream a file via download token.
   */
  async streamFile(token: string, req: Request) {
    const downloadToken = await this.findToken(token);
    const etat = this.stateOf(downloadToken);
    if (etat !== 'valide' || !downloadToken) {
      throw STATE_ERRORS[etat === 'valide' ? 'introuvable' : etat]();
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
