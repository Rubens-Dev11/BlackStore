import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DisputeStatus, Prisma } from '@prisma/client';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '@/prisma';
import { EmailService } from '../email/email.service';
import { SellersService } from '../sellers/sellers.service';
import { WalletService } from '../wallet/wallet.service';
import {
  BLOCKING_DISPUTE_STATUSES,
  DISPUTE_REASON_LABELS,
  DOUBLE_PAYMENT_WINDOW_DAYS,
  OPERATOR_LABELS,
  REQUEST_WINDOW_DAYS,
  buyerPublicName,
  formatDoualaDate,
  requestDeadline,
  sellerDeadlineFrom,
} from './dispute-rules';
import { CreateDisputeDto, DisputeListFilter, FindDisputableOrderDto, HandleDisputeDto, RespondDisputeDto } from './dto/dispute.dto';

const ORDER_INCLUDE = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: { select: { name: true, store: { select: { sellerId: true } } } },
      dispute: { select: { reference: true, status: true } },
    },
  },
} satisfies Prisma.OrderInclude;

const DISPUTE_INCLUDE = {
  orderItem: {
    select: {
      id: true,
      priceAtPurchase: true,
      product: { select: { id: true, name: true, slug: true, store: { select: { name: true, slug: true } } } },
      order: {
        select: { id: true, orderNumber: true, buyerName: true, buyerEmail: true, buyerPhone: true, status: true, paidAt: true, createdAt: true },
      },
      walletEntries: { select: { type: true, amount: true } },
    },
  },
  seller: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.DisputeInclude;

type DisputeWithDetails = Prisma.DisputeGetPayload<{ include: typeof DISPUTE_INCLUDE }>;

const DECIDED: DisputeStatus[] = ['accepted', 'refunded', 'rejected'];
const isBlocking = (status: DisputeStatus) => BLOCKING_DISPUTE_STATUSES.includes(status);

/**
 * Litiges : demandes de remboursement des acheteurs, selon la politique publiée. L'acheteur retrouve sa
 * commande (numéro + e-mail) et décrit le problème ; le vendeur a 5 jours pour répondre ou corriger son
 * produit ; l'administrateur rembourse (l'argent est renvoyé à la main par Mobile Money) ou refuse.
 * Pendant le litige, le montant de la vente est bloqué dans le solde du vendeur (voir WalletService).
 */
@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly walletService: WalletService,
  ) {}

  // ── Acheteur ────────────────────────────────────────────────────────

  private async findBuyerOrder(dto: FindDisputableOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber: dto.orderNumber, buyerEmail: { equals: dto.email, mode: 'insensitive' } },
      include: ORDER_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException('Commande introuvable : vérifiez le numéro (il commence par BS-) et l’adresse e-mail utilisée pour la commande.');
    }
    if (order.status === 'refunded') {
      throw new ConflictException('Cette commande a déjà été remboursée.');
    }
    if (order.status !== 'paid') {
      throw new ConflictException(
        'Cette commande n’a pas été payée : il n’y a rien à rembourser. Débité sans commande confirmée ? Écrivez-nous depuis la page Contact.',
      );
    }
    return order;
  }

  /** Commande de l'acheteur et produits pour lesquels une demande est possible. */
  async findOrder(dto: FindDisputableOrderDto) {
    const order = await this.findBuyerOrder(dto);
    const paidAt = order.paidAt ?? order.createdAt;
    const deadline = requestDeadline(paidAt, null);
    const doublePaymentDeadline = requestDeadline(paidAt, 'double_payment');
    const now = Date.now();
    return {
      orderNumber: order.orderNumber,
      paidAt,
      deadline,
      doublePaymentDeadline,
      // Délais calculés ici : l'horloge du téléphone de l'acheteur peut être fausse.
      open: now <= deadline.getTime(),
      openForDoublePayment: now <= doublePaymentDeadline.getTime(),
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        price: item.priceAtPurchase,
        dispute: item.dispute ? { reference: item.dispute.reference, status: item.dispute.status } : null,
        blocker:
          item.priceAtPurchase === 0
            ? 'Produit gratuit : il n’est pas remboursable.'
            : item.dispute
              ? `Une demande existe déjà pour ce produit (${item.dispute.reference}).`
              : null,
      })),
    };
  }

  async create(dto: CreateDisputeDto, ip: string | undefined) {
    const confirmation = 'Demande enregistrée : vous allez recevoir un e-mail de confirmation avec sa référence.';
    // Champ piège rempli : un robot. On fait comme si tout allait bien, sans rien enregistrer.
    if (dto.website?.trim()) {
      this.logger.warn('Demande de remboursement ignorée (champ piège rempli)');
      return { reference: null, message: confirmation, withSeller: true };
    }

    const order = await this.findBuyerOrder(dto);
    const item = order.items.find((i) => i.id === dto.orderItemId);
    if (!item) {
      throw new NotFoundException('Ce produit ne fait pas partie de la commande.');
    }
    if (item.priceAtPurchase === 0) {
      throw new BadRequestException(
        'Ce produit est gratuit : il n’est pas remboursable. Pour signaler un problème, utilisez « Signaler ce produit » sur sa fiche.',
      );
    }
    if (item.dispute) {
      throw new ConflictException(`Une demande existe déjà pour ce produit (${item.dispute.reference}).`);
    }
    const deadline = requestDeadline(order.paidAt ?? order.createdAt, dto.reason);
    if (Date.now() > deadline.getTime()) {
      const days = dto.reason === 'double_payment' ? DOUBLE_PAYMENT_WINDOW_DAYS : REQUEST_WINDOW_DAYS;
      throw new BadRequestException(
        `Le délai est dépassé : une demande doit être faite dans les ${days} jours qui suivent l’achat (avant le ${formatDoualaDate(deadline)}).`,
      );
    }
    const phone = SellersService.normalizePhone(dto.refundPhone);
    if (!/^\+2376\d{8}$/.test(phone)) {
      throw new BadRequestException('Indiquez un numéro Mobile Money camerounais (6XX XX XX XX)');
    }

    const sellerId = item.product.store?.sellerId ?? null;
    const now = new Date();
    let created;
    try {
      created = await this.prisma.dispute.create({
        data: {
          reference: await this.newReference(),
          orderItemId: item.id,
          sellerId,
          reason: dto.reason,
          description: dto.description,
          refundOperator: dto.refundOperator,
          refundPhone: phone,
          refundAccountName: dto.refundAccountName,
          // Produit BlackStore : pas de vendeur à consulter, la demande va directement à l'administrateur.
          status: sellerId ? 'open' : 'review',
          sellerDeadline: sellerId ? sellerDeadlineFrom(now) : null,
          ipHash: ip ? createHash('sha256').update(ip).digest('hex') : null,
        },
        include: DISPUTE_INCLUDE,
      });
    } catch (error) {
      // Deux envois simultanés pour le même produit : un seul passe.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && String(error.meta?.target).includes('order_item_id')) {
        throw new ConflictException('Une demande existe déjà pour ce produit.');
      }
      throw error;
    }
    this.logger.log(`Litige ${created.reference} ouvert (commande ${order.orderNumber}, ${created.reason})`);

    await this.emailService.sendDisputeReceived(order.buyerEmail, order.buyerName, {
      reference: created.reference,
      productName: item.product.name,
      reasonLabel: DISPUTE_REASON_LABELS[created.reason],
      sellerDeadline: created.sellerDeadline,
    });
    if (created.seller && created.sellerDeadline) {
      await this.emailService.sendSellerDisputeOpened(created.seller.email, created.seller.firstName, {
        reference: created.reference,
        productName: item.product.name,
        reasonLabel: DISPUTE_REASON_LABELS[created.reason],
        description: created.description,
        deadline: created.sellerDeadline,
      });
    }
    // withSeller : le client sait si un vendeur doit d'abord répondre (5 jours) ou si BlackStore décide seul.
    return { reference: created.reference, message: confirmation, withSeller: sellerId !== null };
  }

  private async newReference(): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 10; attempt++) {
      const reference = `LIT-${year}-${randomInt(10000, 100000)}`;
      const taken = await this.prisma.dispute.findUnique({ where: { reference }, select: { id: true } });
      if (!taken) return reference;
    }
    throw new ConflictException('Référence indisponible pour le moment : réessayez.');
  }

  // ── Vendeur ─────────────────────────────────────────────────────────

  async listForSeller(sellerId: string) {
    const disputes = await this.prisma.dispute.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      include: DISPUTE_INCLUDE,
      take: 200,
    });
    return disputes.map((d) => this.sellerView(d));
  }

  /** Réponse du vendeur (une seule) : le litige passe alors à la décision de l'administrateur. */
  async respond(sellerId: string, id: string, dto: RespondDisputeDto) {
    const dispute = await this.prisma.dispute.findFirst({ where: { id, sellerId }, select: { status: true, sellerRespondedAt: true } });
    if (!dispute) {
      throw new NotFoundException('Litige introuvable');
    }
    if (!isBlocking(dispute.status)) {
      throw new ConflictException('Ce litige est déjà tranché.');
    }
    if (dispute.sellerRespondedAt) {
      throw new ConflictException('Vous avez déjà répondu à ce litige.');
    }
    const changed = await this.prisma.dispute.updateMany({
      where: { id, sellerId, sellerRespondedAt: null, status: { in: BLOCKING_DISPUTE_STATUSES } },
      data: { sellerResponse: dto.message, sellerAcceptsRefund: dto.acceptRefund, sellerRespondedAt: new Date(), status: 'review' },
    });
    if (changed.count === 0) {
      throw new ConflictException('Vous avez déjà répondu à ce litige.');
    }
    const updated = await this.prisma.dispute.findUniqueOrThrow({ where: { id }, include: DISPUTE_INCLUDE });
    this.logger.log(`Litige ${updated.reference} : réponse du vendeur (${dto.acceptRefund ? 'accepte' : 'conteste'} le remboursement)`);
    return this.sellerView(updated);
  }

  private sellerView(d: DisputeWithDetails) {
    const order = d.orderItem.order;
    const sale = d.orderItem.walletEntries.find((e) => e.type === 'sale');
    return {
      id: d.id,
      reference: d.reference,
      status: d.status,
      reason: d.reason,
      reasonLabel: DISPUTE_REASON_LABELS[d.reason],
      description: d.description,
      createdAt: d.createdAt,
      sellerDeadline: d.sellerDeadline,
      late: d.status === 'open' && !!d.sellerDeadline && d.sellerDeadline < new Date(),
      sellerResponse: d.sellerResponse,
      sellerAcceptsRefund: d.sellerAcceptsRefund,
      sellerRespondedAt: d.sellerRespondedAt,
      decisionNote: DECIDED.includes(d.status) ? d.decisionNote : null,
      decidedAt: d.decidedAt,
      productName: d.orderItem.product.name,
      orderNumber: order.orderNumber,
      buyerName: buyerPublicName(order.buyerName),
      paidAt: order.paidAt ?? order.createdAt,
      amount: d.orderItem.priceAtPurchase,
      /** Part du vendeur sur cette vente (commission déduite), bloquée pendant le litige. */
      sellerAmount: sale?.amount ?? null,
      canRespond: isBlocking(d.status) && !d.sellerRespondedAt,
    };
  }

  // ── Administration ──────────────────────────────────────────────────

  /**
   * À traiter : réponse du vendeur reçue, délai du vendeur dépassé, produit BlackStore, ou remboursement
   * accordé à envoyer. En attente : le vendeur a encore le temps de répondre. Clos : remboursé ou refusé.
   */
  async listForAdmin(filter: DisputeListFilter) {
    const now = new Date();
    const where: Prisma.DisputeWhereInput =
      filter === 'waiting'
        ? { status: 'open', sellerDeadline: { gte: now } }
        : filter === 'closed'
          ? { status: { in: ['refunded', 'rejected'] } }
          : { OR: [{ status: { in: ['review', 'accepted'] } }, { status: 'open', OR: [{ sellerDeadline: null }, { sellerDeadline: { lt: now } }] }] };
    const orderBy: Prisma.DisputeOrderByWithRelationInput[] =
      filter === 'closed' ? [{ decidedAt: 'desc' }] : filter === 'waiting' ? [{ sellerDeadline: 'asc' }] : [{ createdAt: 'asc' }];
    const disputes = await this.prisma.dispute.findMany({ where, orderBy, include: DISPUTE_INCLUDE, take: 200 });
    return disputes.map((d) => this.adminView(d));
  }

  async handle(id: string, dto: HandleDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id }, include: DISPUTE_INCLUDE });
    if (!dispute) {
      throw new NotFoundException('Litige introuvable');
    }
    const order = dispute.orderItem.order;
    const productName = dispute.orderItem.product.name;
    const sellerAmount = dispute.orderItem.walletEntries.find((e) => e.type === 'sale')?.amount ?? null;

    if (dto.action === 'accept') {
      if (!isBlocking(dispute.status)) {
        throw new ConflictException('Ce litige est déjà tranché.');
      }
      // Remboursement de l'article : vente annulée chez le vendeur, liens coupés, et commande
      // « remboursée » quand tous ses articles le sont. Tout ou rien.
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.dispute.updateMany({
          where: { id, status: { in: BLOCKING_DISPUTE_STATUSES } },
          data: { status: 'accepted', decidedAt: new Date(), decisionNote: dto.note ?? null },
        });
        if (changed.count === 0) {
          throw new ConflictException('Ce litige vient d’être tranché.');
        }
        await this.walletService.refundOrderItem(tx, dispute.orderItemId);
        await tx.downloadToken.updateMany({ where: { orderItemId: dispute.orderItemId }, data: { isActive: false } });
        const items = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { dispute: { select: { status: true } } } });
        if (items.every((i) => i.dispute && (i.dispute.status === 'accepted' || i.dispute.status === 'refunded'))) {
          await tx.order.update({ where: { id: order.id }, data: { status: 'refunded' } });
        }
      });
      this.logger.log(`Litige ${dispute.reference} : remboursement accordé`);
      await this.emailService.sendDisputeDecision(order.buyerEmail, order.buyerName, {
        reference: dispute.reference,
        productName,
        accepted: true,
        amount: dispute.orderItem.priceAtPurchase,
        operatorLabel: OPERATOR_LABELS[dispute.refundOperator],
        phone: dispute.refundPhone,
        note: dto.note ?? null,
      });
      if (dispute.seller) {
        await this.emailService.sendSellerDisputeDecision(dispute.seller.email, dispute.seller.firstName, {
          reference: dispute.reference,
          productName,
          accepted: true,
          sellerAmount,
          note: dto.note ?? null,
        });
      }
    } else if (dto.action === 'reject') {
      if (!dto.note || dto.note.length < 5) {
        throw new BadRequestException('Indiquez le motif du refus : il est envoyé au client.');
      }
      const changed = await this.prisma.dispute.updateMany({
        where: { id, status: { in: BLOCKING_DISPUTE_STATUSES } },
        data: { status: 'rejected', decidedAt: new Date(), decisionNote: dto.note },
      });
      if (changed.count === 0) {
        throw new ConflictException('Ce litige est déjà tranché.');
      }
      this.logger.log(`Litige ${dispute.reference} : demande refusée`);
      await this.emailService.sendDisputeDecision(order.buyerEmail, order.buyerName, {
        reference: dispute.reference,
        productName,
        accepted: false,
        amount: dispute.orderItem.priceAtPurchase,
        operatorLabel: OPERATOR_LABELS[dispute.refundOperator],
        phone: dispute.refundPhone,
        note: dto.note,
      });
      if (dispute.seller) {
        await this.emailService.sendSellerDisputeDecision(dispute.seller.email, dispute.seller.firstName, {
          reference: dispute.reference,
          productName,
          accepted: false,
          sellerAmount,
          note: dto.note,
        });
      }
    } else {
      if (dispute.status !== 'accepted') {
        throw new ConflictException('Seul un remboursement accordé peut être marqué comme envoyé.');
      }
      if (!dto.reference || dto.reference.length < 3) {
        throw new BadRequestException('Indiquez la référence de l’envoi Mobile Money (dans le SMS de confirmation).');
      }
      const changed = await this.prisma.dispute.updateMany({
        where: { id, status: 'accepted' },
        data: { status: 'refunded', refundReference: dto.reference, refundedAt: new Date() },
      });
      if (changed.count === 0) {
        throw new ConflictException('Ce remboursement est déjà marqué comme envoyé.');
      }
      this.logger.log(`Litige ${dispute.reference} : remboursement envoyé`);
      await this.emailService.sendDisputeRefunded(order.buyerEmail, order.buyerName, {
        reference: dispute.reference,
        productName,
        amount: dispute.orderItem.priceAtPurchase,
        operatorLabel: OPERATOR_LABELS[dispute.refundOperator],
        phone: dispute.refundPhone,
        transferReference: dto.reference,
      });
    }

    const updated = await this.prisma.dispute.findUniqueOrThrow({ where: { id }, include: DISPUTE_INCLUDE });
    return this.adminView(updated);
  }

  private adminView(d: DisputeWithDetails) {
    const order = d.orderItem.order;
    return {
      ...this.sellerView(d),
      decisionNote: d.decisionNote,
      buyer: { name: order.buyerName, email: order.buyerEmail, phone: order.buyerPhone },
      refund: {
        operator: d.refundOperator,
        operatorLabel: OPERATOR_LABELS[d.refundOperator],
        phone: d.refundPhone,
        accountName: d.refundAccountName,
        reference: d.refundReference,
        refundedAt: d.refundedAt,
      },
      orderStatus: order.status,
      product: { name: d.orderItem.product.name, slug: d.orderItem.product.slug },
      store: d.orderItem.product.store,
      seller: d.seller ? { name: `${d.seller.firstName} ${d.seller.lastName}`, email: d.seller.email } : null,
    };
  }
}
