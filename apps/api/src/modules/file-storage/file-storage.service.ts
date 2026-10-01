import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { pipeline, Readable, Transform } from 'stream';

@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly minioClient: Minio.Client;
  // Client dédié à la génération d'URLs presigned : pointé sur l'hôte PUBLIC
  // (joignable par le navigateur). La signature inclut le Host, donc on doit
  // signer directement pour l'hôte public — une simple réécriture de chaîne
  // casserait la signature (SignatureDoesNotMatch). region fixée => presign
  // purement local, aucun appel réseau vers l'hôte public.
  private readonly minioPublicClient: Minio.Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const endPoint = this.configService.get<string>('MINIO_ENDPOINT', 'minio');
    const port = this.configService.get<number>('MINIO_PORT', 9000);
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin');

    this.minioClient = new Minio.Client({
      endPoint,
      port,
      useSSL: false,
      accessKey,
      secretKey,
    });

    const publicUrl = new URL(
      this.configService.get<string>('MINIO_PUBLIC_URL', `http://localhost:${port}`),
    );
    const useSSL = publicUrl.protocol === 'https:';
    this.minioPublicClient = new Minio.Client({
      endPoint: publicUrl.hostname,
      port: publicUrl.port ? Number(publicUrl.port) : useSSL ? 443 : 80,
      useSSL,
      accessKey,
      secretKey,
      region: 'us-east-1',
    });

    this.bucketName = this.configService.get<string>('MINIO_BUCKET', 'blackstore-files');
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucketExists();
  }

  async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName);
        this.logger.log(`Bucket ${this.bucketName} créé avec succès.`);
      } else {
        this.logger.log(`Bucket ${this.bucketName} déjà existant.`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erreur bucket MinIO: ${message}`);
    }
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<{ objectKey: string; sha256: string; sizeBytes: number }> {
    const objectKey = `${randomUUID()}/${Date.now()}-${originalName}`;
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const sizeBytes = buffer.length;

    await this.minioClient.putObject(
      this.bucketName,
      objectKey,
      buffer,
      sizeBytes,
      { 'Content-Type': mimeType },
    );

    this.logger.log(`Fichier uploadé : ${objectKey}`);
    return { objectKey, sha256, sizeBytes };
  }

  /**
   * Fichier d'un produit de vendeur, envoyé depuis le fichier temporaire du disque
   * (jamais entièrement en mémoire) : empreinte SHA-256 calculée au passage.
   * Toujours servi en téléchargement, quel que soit son contenu.
   */
  async uploadProductFileFromDisk(
    tempPath: string,
    productId: string,
    fileName: string,
  ): Promise<{ objectKey: string; sha256: string; sizeBytes: number }> {
    const sizeBytes = (await fs.promises.stat(tempPath)).size;
    const objectKey = `products/${productId}/${randomUUID()}/${fileName}`;
    const hash = crypto.createHash('sha256');
    const hashing = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    // pipeline détruit les deux flux en cas d'erreur de lecture : l'envoi échoue alors proprement.
    pipeline(fs.createReadStream(tempPath), hashing, () => undefined);

    await this.minioClient.putObject(this.bucketName, objectKey, hashing, sizeBytes, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });

    this.logger.log(`Fichier vendeur uploadé : ${objectKey} (${sizeBytes} octets)`);
    return { objectKey, sha256: hash.digest('hex'), sizeBytes };
  }

  /** Lecture en flux d'un fichier stocké (analyse antivirus). */
  async getObjectStream(objectKey: string): Promise<Readable> {
    return this.minioClient.getObject(this.bucketName, objectKey);
  }

  async uploadScreenshot(
    buffer: Buffer,
    productId: string,
    index: number,
    mimeType = 'image/webp',
  ): Promise<string> {
    const ext = (mimeType.split('/')[1] || 'webp').split('+')[0];
    const objectKey = `screenshots/${productId}/${index}-${randomUUID()}.${ext}`;

    await this.minioClient.putObject(
      this.bucketName,
      objectKey,
      buffer,
      buffer.length,
      { 'Content-Type': mimeType },
    );

    this.logger.log(`Screenshot uploadé : ${objectKey}`);
    return objectKey;
  }

  async uploadCoverImage(
    buffer: Buffer,
    productId: string,
    mimeType: string,
  ): Promise<string> {
    const ext = (mimeType.split('/')[1] || 'jpg').split('+')[0];
    const objectKey = `covers/${productId}/${randomUUID()}.${ext}`;

    await this.minioClient.putObject(
      this.bucketName,
      objectKey,
      buffer,
      buffer.length,
      { 'Content-Type': mimeType },
    );

    this.logger.log(`Image de couverture uploadée : ${objectKey}`);
    return objectKey;
  }

  async uploadStoreLogo(
    buffer: Buffer,
    storeId: string,
    mimeType: string,
  ): Promise<string> {
    const ext = (mimeType.split('/')[1] || 'png').split('+')[0];
    const objectKey = `stores/${storeId}/logo-${randomUUID()}.${ext}`;

    await this.minioClient.putObject(
      this.bucketName,
      objectKey,
      buffer,
      buffer.length,
      { 'Content-Type': mimeType },
    );

    this.logger.log(`Logo de boutique uploadé : ${objectKey}`);
    return objectKey;
  }

  /** Supprime un fichier ; un échec est journalisé sans bloquer (il reste au pire un fichier orphelin). */
  async removeObject(objectKey: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, objectKey);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Suppression impossible de ${objectKey} : ${message}`);
    }
  }

  async getPresignedUrl(
    objectKey: string,
    expiresInSeconds: number,
    responseHeaders?: Record<string, string>,
  ): Promise<string> {
    // Signé directement pour l'hôte public => URL valide et joignable par le navigateur.
    const respHeaders = responseHeaders ?? {};
    const requestDate = new Date();
    return await this.minioPublicClient.presignedGetObject(
      this.bucketName,
      objectKey,
      expiresInSeconds,
      respHeaders,
      requestDate,
    );
  }

  async deleteFile(objectKey: string): Promise<void> {
    await this.minioClient.removeObject(this.bucketName, objectKey);
    this.logger.log(`Fichier supprimé : ${objectKey}`);
  }
}
