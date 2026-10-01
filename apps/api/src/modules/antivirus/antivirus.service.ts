import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@/prisma';
import { FileStorageService } from '../file-storage/file-storage.service';
import { EmailService } from '../email/email.service';
import { ClamdTarget, ping, scanStream } from './clamd';

export const FILE_SCAN_QUEUE = 'file-scan';

export interface FileScanJob {
  productId: string;
  objectKey: string;
}

/**
 * Analyse antivirus des fichiers déposés par les vendeurs, en arrière-plan.
 * Tant que l'analyse n'a pas conclu à un fichier sain, le produit reste invisible
 * et son fichier ne peut pas être téléchargé.
 */
@Injectable()
export class AntivirusService implements OnModuleInit {
  private readonly logger = new Logger(AntivirusService.name);
  private readonly clamd: ClamdTarget;

  constructor(
    @InjectQueue(FILE_SCAN_QUEUE) private readonly queue: Queue<FileScanJob>,
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly emailService: EmailService,
    configService: ConfigService,
  ) {
    this.clamd = {
      host: configService.get<string>('CLAMAV_HOST', 'clamav'),
      port: Number(configService.get<number>('CLAMAV_PORT', 3310)),
      timeoutMs: 15 * 60 * 1000,
    };
  }

  onModuleInit(): void {
    // Simple information au démarrage : ClamAV peut mettre une minute à charger ses signatures.
    void ping(this.clamd).then((ok) =>
      ok
        ? this.logger.log(`Antivirus joignable (${this.clamd.host}:${this.clamd.port})`)
        : this.logger.warn(`Antivirus injoignable (${this.clamd.host}:${this.clamd.port}) : les analyses seront rejouées`),
    );
  }

  /** Programme l'analyse du fichier actuel d'un produit (le statut doit déjà être « pending »). */
  async enqueue(productId: string, objectKey: string): Promise<void> {
    await this.queue.add(
      'scan',
      { productId, objectKey },
      {
        // ClamAV indisponible : nouvel essai après 30 s, 1 min, 2 min, 4 min puis 8 min.
        attempts: 6,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 200,
        removeOnFail: 200,
      },
    );
  }

  /** Analyse un fichier ; ignore celui d'un produit dont le fichier a été remplacé entre-temps. */
  async scanProductFile({ productId, objectKey }: FileScanJob): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { store: { include: { seller: true } } },
    });
    if (!product || product.filePath !== objectKey) {
      this.logger.log(`Analyse ignorée : le fichier ${objectKey} n'est plus celui du produit ${productId}`);
      return;
    }

    const started = Date.now();
    const verdict = await scanStream(this.clamd, await this.fileStorageService.getObjectStream(objectKey));
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    if (!verdict.infected) {
      await this.prisma.product.updateMany({
        where: { id: productId, filePath: objectKey },
        data: { scanStatus: 'clean', scanResult: null, scannedAt: new Date() },
      });
      this.logger.log(`Fichier sain : ${objectKey} (${seconds} s)`);
      return;
    }

    // Menace : le fichier est supprimé et le vendeur prévenu ; le produit reste invisible.
    const updated = await this.prisma.product.updateMany({
      where: { id: productId, filePath: objectKey },
      data: {
        scanStatus: 'infected',
        scanResult: verdict.signature.slice(0, 200),
        scannedAt: new Date(),
        filePath: null,
        fileHash: null,
        fileSizeMb: null,
      },
    });
    await this.fileStorageService.removeObject(objectKey);
    this.logger.warn(`Menace « ${verdict.signature} » dans ${objectKey} (produit ${productId}) : fichier supprimé`);
    if (updated.count > 0 && product.store) {
      const { seller } = product.store;
      await this.emailService.sendSellerFileInfected(seller.email, seller.firstName, product.name, verdict.signature);
    }
  }

  /** Après le dernier essai : le fichier reste bloqué, l'administrateur peut relancer l'analyse. */
  async markFailed({ productId, objectKey }: FileScanJob, reason: string): Promise<void> {
    await this.prisma.product.updateMany({
      where: { id: productId, filePath: objectKey, scanStatus: 'pending' },
      data: { scanStatus: 'failed', scanResult: reason.slice(0, 200), scannedAt: new Date() },
    });
    this.logger.error(`Analyse impossible pour ${objectKey} (produit ${productId}) : ${reason}`);
  }
}
