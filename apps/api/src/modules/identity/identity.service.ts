import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IdentityCheck, IdentityCheckStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma';
import { EmailService } from '../email/email.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { detectImageType } from '../file-storage/image-type';
import { SubmitIdentityDto } from './dto/identity.dto';
import 'multer';

/** Photo d'une pièce ou selfie : 8 Mo au plus (photo de téléphone). */
export const IDENTITY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
/** Liens de consultation des photos par l'administrateur : 10 minutes, jamais mis en cache. */
const IMAGE_URL_TTL = 10 * 60;

export interface IdentityFiles {
  documentFront?: Express.Multer.File[];
  documentBack?: Express.Multer.File[];
  selfie?: Express.Multer.File[];
}

const REVIEW_INCLUDE = {
  seller: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, createdAt: true } },
} satisfies Prisma.IdentityCheckInclude;

type ReviewRecord = Prisma.IdentityCheckGetPayload<{ include: typeof REVIEW_INCLUDE }>;

/**
 * Vérification d'identité des vendeurs avant leur premier retrait : selfie et CNI ou passeport,
 * contrôlés par l'administrateur. Les photos restent privées et sont effacées en cas de refus.
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly emailService: EmailService,
  ) {}

  // ── Vendeur ─────────────────────────────────────────────────────────

  /** État de la dernière vérification du vendeur (« none » s'il n'a rien envoyé). */
  async getMine(sellerId: string) {
    const check = await this.latest(sellerId);
    return {
      status: check?.status ?? 'none',
      documentType: check?.documentType ?? null,
      fullName: check?.fullName ?? null,
      submittedAt: check?.createdAt ?? null,
      reviewedAt: check?.reviewedAt ?? null,
      reviewNote: check?.reviewNote ?? null,
    };
  }

  async submit(sellerId: string, dto: SubmitIdentityDto, files: IdentityFiles = {}) {
    const previous = await this.latest(sellerId);
    if (previous?.status === 'pending') {
      throw new ConflictException('Votre vérification est déjà en cours : vous recevrez un e-mail dès qu’elle sera traitée');
    }
    if (previous?.status === 'approved') {
      throw new ConflictException('Votre identité est déjà vérifiée');
    }

    const front = files.documentFront?.[0];
    const back = files.documentBack?.[0];
    const selfie = files.selfie?.[0];
    if (!front) throw new BadRequestException('Ajoutez la photo de votre pièce (recto ou page d’identité)');
    if (dto.documentType === 'cni' && !back) throw new BadRequestException('Ajoutez la photo du verso de votre CNI');
    if (!selfie) throw new BadRequestException('Ajoutez votre selfie en tenant la pièce');
    const images = [
      { kind: 'recto', file: front },
      ...(back ? [{ kind: 'verso', file: back }] : []),
      { kind: 'selfie', file: selfie },
    ].map(({ kind, file }) => {
      const type = detectImageType(file.buffer);
      if (!type) {
        throw new BadRequestException(`La photo « ${kind} » doit être une image JPG, PNG ou WebP`);
      }
      return { kind, buffer: file.buffer, type };
    });

    // Photos rangées par vendeur et par envoi ; supprimées si l'enregistrement échoue.
    const prefix = `identity/${sellerId}/${randomUUID()}`;
    const keys: Record<string, string> = {};
    try {
      for (const image of images) {
        const key = `${prefix}-${image.kind}.${image.type.split('/')[1]}`;
        await this.fileStorageService.uploadPrivateImage(image.buffer, key, image.type);
        keys[image.kind] = key;
      }
      await this.prisma.identityCheck.create({
        data: {
          sellerId,
          documentType: dto.documentType,
          fullName: dto.fullName,
          documentFrontKey: keys.recto,
          documentBackKey: keys.verso ?? null,
          selfieKey: keys.selfie,
        },
      });
    } catch (error) {
      await Promise.all(Object.values(keys).map((key) => this.fileStorageService.removeObject(key)));
      throw error;
    }
    this.logger.log(`Vérification d'identité envoyée par le vendeur ${sellerId}`);
    return this.getMine(sellerId);
  }

  // ── Administration ──────────────────────────────────────────────────

  /** Vérifications d'un statut ; la file « pending » commence par les plus anciennes. */
  async list(status: IdentityCheckStatus) {
    const checks = await this.prisma.identityCheck.findMany({
      where: { status },
      orderBy: status === 'pending' ? { createdAt: 'asc' } : { reviewedAt: 'desc' },
      take: 200,
      include: REVIEW_INCLUDE,
    });
    return Promise.all(checks.map((c) => this.toAdminView(c)));
  }

  /** Valider, ou refuser avec un motif (les photos sont alors effacées). Le vendeur est prévenu par e-mail. */
  async review(checkId: string, decision: 'approve' | 'reject', note?: string | null) {
    const check = await this.prisma.identityCheck.findUnique({ where: { id: checkId }, include: REVIEW_INCLUDE });
    if (!check) {
      throw new NotFoundException('Vérification introuvable');
    }
    if (check.status !== 'pending') {
      throw new ConflictException('Cette vérification a déjà été traitée');
    }
    const reason = note?.trim() ?? '';
    if (decision === 'reject' && reason.length < 5) {
      throw new BadRequestException('Indiquez le motif du refus (5 caractères au moins) : il sera envoyé au vendeur');
    }

    const updated = await this.prisma.identityCheck.update({
      where: { id: check.id },
      data:
        decision === 'approve'
          ? { status: 'approved', reviewedAt: new Date(), reviewNote: null }
          : { status: 'rejected', reviewedAt: new Date(), reviewNote: reason, documentFrontKey: null, documentBackKey: null, selfieKey: null },
      include: REVIEW_INCLUDE,
    });
    if (decision === 'reject') {
      await Promise.all(IdentityService.keysOf(check).map((key) => this.fileStorageService.removeObject(key)));
    }
    this.logger.log(`Vérification d'identité du vendeur ${check.sellerId} : ${decision === 'approve' ? 'validée' : 'refusée'}`);
    await this.emailService.sendSellerIdentityReview(
      check.seller.email,
      check.seller.firstName,
      decision === 'approve' ? 'approved' : 'rejected',
      decision === 'reject' ? reason : null,
    );
    return this.toAdminView(updated);
  }

  // ── Outils ──────────────────────────────────────────────────────────

  private latest(sellerId: string) {
    return this.prisma.identityCheck.findFirst({ where: { sellerId }, orderBy: { createdAt: 'desc' } });
  }

  private static keysOf(check: IdentityCheck): string[] {
    return [check.documentFrontKey, check.documentBackKey, check.selfieKey].filter((k): k is string => !!k);
  }

  private sign(key: string | null) {
    return key
      ? this.fileStorageService.getPresignedUrl(key, IMAGE_URL_TTL, {
          'response-content-disposition': 'inline',
          'response-cache-control': 'no-store',
        })
      : Promise.resolve(null);
  }

  private async toAdminView(check: ReviewRecord) {
    const [documentFrontUrl, documentBackUrl, selfieUrl] = await Promise.all([
      this.sign(check.documentFrontKey),
      this.sign(check.documentBackKey),
      this.sign(check.selfieKey),
    ]);
    return {
      id: check.id,
      documentType: check.documentType,
      fullName: check.fullName,
      status: check.status,
      reviewNote: check.reviewNote,
      reviewedAt: check.reviewedAt,
      submittedAt: check.createdAt,
      images: { documentFrontUrl, documentBackUrl, selfieUrl },
      seller: check.seller,
    };
  }
}
