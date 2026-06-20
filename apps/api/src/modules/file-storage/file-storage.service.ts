import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';

@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly minioClient: Minio.Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'minio'),
      port: this.configService.get<number>('MINIO_PORT', 9000),
      useSSL: false,
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
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

  async uploadScreenshot(
    buffer: Buffer,
    productId: string,
    index: number,
  ): Promise<string> {
    const objectKey = `screenshots/${productId}/${index}-${randomUUID()}.webp`;

    await this.minioClient.putObject(
      this.bucketName,
      objectKey,
      buffer,
      buffer.length,
      { 'Content-Type': 'image/webp' },
    );

    this.logger.log(`Screenshot uploadé : ${objectKey}`);
    return objectKey;
  }

  async getPresignedUrl(objectKey: string, expiresInSeconds: number): Promise<string> {
    return await this.minioClient.presignedGetObject(
      this.bucketName,
      objectKey,
      expiresInSeconds,
    );
  }

  async deleteFile(objectKey: string): Promise<void> {
    await this.minioClient.removeObject(this.bucketName, objectKey);
    this.logger.log(`Fichier supprimé : ${objectKey}`);
  }
}