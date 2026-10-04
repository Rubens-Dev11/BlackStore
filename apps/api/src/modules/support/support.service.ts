import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupportStatus, SupportTopic } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma';
import { EmailService } from '../email/email.service';
import { CreateSupportRequestDto } from './dto/support.dto';

export const SUPPORT_TOPIC_LABELS: Record<SupportTopic, string> = {
  order: 'Commande ou téléchargement',
  refund: 'Demande de remboursement',
  seller: 'Question de vendeur',
  personal_data: 'Données personnelles',
  other: 'Autre question',
};

/**
 * Messages du formulaire de contact : enregistrés sans e-mail automatique (le formulaire ne peut pas
 * servir à envoyer des e-mails à un tiers) ; l'administrateur répond depuis l'admin, par e-mail.
 */
@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateSupportRequestDto, ip: string | undefined) {
    const confirmation = { message: 'Message envoyé : nous vous répondrons par e-mail, en général sous 2 jours ouvrés.' };
    // Champ piège rempli : un robot. On fait comme si tout allait bien, sans rien enregistrer.
    if (dto.website?.trim()) {
      this.logger.warn('Message de contact ignoré (champ piège rempli)');
      return confirmation;
    }
    const request = await this.prisma.supportRequest.create({
      data: {
        topic: dto.topic,
        name: dto.name,
        email: dto.email,
        orderNumber: dto.orderNumber ? dto.orderNumber.toUpperCase() : null,
        message: dto.message,
        ipHash: ip ? createHash('sha256').update(ip).digest('hex') : null,
      },
    });
    this.logger.log(`Message de contact reçu (${request.topic}) : ${request.id}`);
    return confirmation;
  }

  /** Messages d'un statut ; les plus anciens d'abord quand ils attendent une réponse. */
  async list(status: SupportStatus) {
    const requests = await this.prisma.supportRequest.findMany({
      where: { status },
      orderBy: { createdAt: status === 'open' ? 'asc' : 'desc' },
      take: 200,
    });
    // Commande citée : retrouvée pour aider l'administrateur (statut, montant, même e-mail ou non).
    const numbers = [...new Set(requests.map((r) => r.orderNumber).filter((n): n is string => !!n))];
    const orders = numbers.length
      ? await this.prisma.order.findMany({
          where: { orderNumber: { in: numbers } },
          select: { id: true, orderNumber: true, status: true, totalAmount: true, buyerEmail: true, createdAt: true },
        })
      : [];
    const byNumber = new Map(orders.map((o) => [o.orderNumber, o]));
    return requests.map(({ ipHash: _ipHash, ...r }) => {
      const order = r.orderNumber ? byNumber.get(r.orderNumber) : undefined;
      return {
        ...r,
        topicLabel: SUPPORT_TOPIC_LABELS[r.topic],
        order: order
          ? {
              id: order.id,
              status: order.status,
              totalAmount: order.totalAmount,
              createdAt: order.createdAt,
              sameEmail: order.buyerEmail.toLowerCase() === r.email.toLowerCase(),
            }
          : null,
      };
    });
  }

  async handle(id: string, action: 'reply' | 'close' | 'reopen', reply?: string) {
    const request = await this.prisma.supportRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Message introuvable');
    }

    if (action === 'close' || action === 'reopen') {
      return this.prisma.supportRequest.update({ where: { id }, data: { status: action === 'close' ? 'closed' : 'open' } });
    }

    if (!reply) {
      throw new BadRequestException('Écrivez la réponse à envoyer');
    }
    const settings = await this.prisma.marketplaceSettings.findUnique({ where: { id: 'default' }, select: { contactEmail: true } });
    const storefront = this.configService.get<string>('STOREFRONT_URL', 'http://localhost:3001').replace(/\/+$/, '');
    const sent = await this.emailService.sendSupportReply({
      to: request.email,
      name: request.name,
      topicLabel: SUPPORT_TOPIC_LABELS[request.topic],
      message: request.message,
      reply,
      replyTo: settings?.contactEmail ?? null,
      contactUrl: `${storefront}/contact`,
    });
    if (!sent) {
      throw new ServiceUnavailableException("L'e-mail n'a pas pu partir : réessayez dans quelques minutes");
    }
    // Les réponses successives s'ajoutent, datées, pour garder l'historique de l'échange.
    const now = new Date();
    const history = request.reply
      ? `${request.reply}\n\n— ${now.toLocaleString('fr-FR', { timeZone: 'Africa/Douala' })}\n${reply}`
      : reply;
    this.logger.log(`Réponse envoyée au message ${id}`);
    return this.prisma.supportRequest.update({
      where: { id },
      data: { status: 'answered', reply: history, repliedAt: now },
    });
  }
}
