import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MarketplaceSettings, Prisma, WithdrawalStatus } from '@prisma/client';
import { PrismaService } from '@/prisma';
import { EmailService } from '../email/email.service';
import { SellersService } from '../sellers/sellers.service';
import { RequestWithdrawalDto, UpdateMarketplaceSettingsDto } from './dto/wallet.dto';

type Db = Prisma.TransactionClient | PrismaService;

const DAY_MS = 24 * 3600 * 1000;
/** Montant lisible dans les messages : « 5 000 FCFA ». */
const fcfa = (amount: number) => `${amount.toLocaleString('fr-FR')} FCFA`;

/** Vente créditée à un vendeur, pour le prévenir par e-mail une fois le paiement enregistré. */
export interface CreditedSale {
  sellerId: string;
  productName: string;
  amount: number;
  availableAt: Date;
}

const ENTRY_INCLUDE = {
  orderItem: { select: { product: { select: { name: true } }, order: { select: { orderNumber: true } } } },
  withdrawal: { select: { operator: true, phone: true, status: true, transferReference: true } },
} satisfies Prisma.WalletEntryInclude;

const WITHDRAWAL_ADMIN_INCLUDE = {
  seller: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      store: { select: { name: true, slug: true } },
      identityChecks: { where: { status: 'approved' }, orderBy: { createdAt: 'desc' }, take: 1, select: { fullName: true, reviewedAt: true } },
    },
  },
} satisfies Prisma.WithdrawalInclude;

/**
 * Portefeuille des vendeurs : chaque vente payée crédite le vendeur (commission déduite), l'argent
 * devient retirable après le délai de sécurité, et les retraits vers Mobile Money sont payés à la main
 * par l'administrateur. Le solde est toujours la somme des mouvements.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // ── Réglages ────────────────────────────────────────────────────────

  async getSettings(db: Db = this.prisma): Promise<MarketplaceSettings> {
    return db.marketplaceSettings.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} });
  }

  async updateSettings(dto: UpdateMarketplaceSettingsDto) {
    const settings = await this.prisma.marketplaceSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...dto },
      update: dto,
    });
    this.logger.log(`Réglages : commission ${dto.commissionRate} %, délai ${dto.holdDays} j, retrait minimum ${dto.minWithdrawal} FCFA`);
    return WalletService.settingsView(settings);
  }

  static settingsView(settings: MarketplaceSettings) {
    return {
      commissionRate: Number(settings.commissionRate),
      holdDays: settings.holdDays,
      minWithdrawal: settings.minWithdrawal,
      updatedAt: settings.updatedAt,
    };
  }

  // ── Ventes et remboursements (appelés par les paiements et les commandes) ──

  /**
   * Crédite les vendeurs d'une commande qui vient d'être payée, dans la même transaction que le
   * passage à « payée ». Chaque article n'est crédité qu'une fois, même si la confirmation arrive deux fois.
   */
  async creditPaidOrder(tx: Prisma.TransactionClient, orderId: string): Promise<CreditedSale[]> {
    const items = await tx.orderItem.findMany({
      where: { orderId, priceAtPurchase: { gt: 0 }, product: { storeId: { not: null } } },
      include: { product: { select: { name: true, store: { select: { sellerId: true } } } } },
    });
    if (items.length === 0) return [];

    const settings = await this.getSettings(tx);
    const rate = Number(settings.commissionRate);
    const availableAt = new Date(Date.now() + settings.holdDays * DAY_MS);
    const sales = items.map((item) => {
      const commission = Math.round((item.priceAtPurchase * rate) / 100);
      return {
        item,
        data: {
          sellerId: item.product.store!.sellerId,
          type: 'sale' as const,
          amount: item.priceAtPurchase - commission,
          grossAmount: item.priceAtPurchase,
          commission,
          commissionRate: settings.commissionRate,
          availableAt,
          orderItemId: item.id,
        },
      };
    });
    const created = await tx.walletEntry.createMany({ data: sales.map((s) => s.data), skipDuplicates: true });
    if (created.count === 0) return [];
    this.logger.log(`Commande ${orderId} : ${created.count} vente(s) créditée(s) aux vendeurs`);
    return sales.map((s) => ({ sellerId: s.data.sellerId, productName: s.item.product.name, amount: s.data.amount, availableAt }));
  }

  /** Prévient chaque vendeur de ses ventes (après l'enregistrement du paiement ; un échec d'envoi est sans effet). */
  async notifySales(sales: CreditedSale[]): Promise<void> {
    for (const sale of sales) {
      const seller = await this.prisma.seller.findUnique({ where: { id: sale.sellerId }, select: { email: true, firstName: true } });
      if (seller) {
        await this.emailService.sendSellerSale(seller.email, seller.firstName, sale.productName, sale.amount, sale.availableAt);
      }
    }
  }

  /**
   * Remboursement d'une commande : chaque vente créditée est annulée par un mouvement inverse, rangé à la
   * même date de disponibilité (pendant le délai de sécurité, le vendeur ne voit jamais l'argent).
   */
  async refundOrder(tx: Prisma.TransactionClient, orderId: string): Promise<number> {
    const sales = await tx.walletEntry.findMany({ where: { type: 'sale', orderItem: { orderId } } });
    if (sales.length === 0) return 0;
    const created = await tx.walletEntry.createMany({
      data: sales.map((sale) => ({
        sellerId: sale.sellerId,
        type: 'refund' as const,
        amount: -sale.amount,
        grossAmount: sale.grossAmount !== null ? -sale.grossAmount : null,
        commission: sale.commission !== null ? -sale.commission : null,
        commissionRate: sale.commissionRate,
        availableAt: sale.availableAt,
        orderItemId: sale.orderItemId,
      })),
      skipDuplicates: true,
    });
    this.logger.log(`Commande ${orderId} remboursée : ${created.count} vente(s) annulée(s) chez les vendeurs`);
    return created.count;
  }

  // ── Solde et historique du vendeur ──────────────────────────────────

  /** Solde retirable (ventes passées le délai, moins les retraits) et solde encore en attente. */
  async balanceOf(sellerId: string, db: Db = this.prisma) {
    const now = new Date();
    // L'une après l'autre : la fonction sert aussi dans une transaction.
    const available = await db.walletEntry.aggregate({ where: { sellerId, availableAt: { lte: now } }, _sum: { amount: true } });
    const pending = await db.walletEntry.aggregate({ where: { sellerId, availableAt: { gt: now } }, _sum: { amount: true } });
    const availableAmount = available._sum.amount ?? 0;
    const pendingAmount = pending._sum.amount ?? 0;
    return { available: availableAmount, pending: pendingAmount, total: availableAmount + pendingAmount };
  }

  async summaryFor(sellerId: string) {
    const [seller, settings, balance, sales, refunds, paidOut, pendingWithdrawal, nextRelease, identity] = await Promise.all([
      this.prisma.seller.findUnique({ where: { id: sellerId }, select: { status: true, phone: true } }),
      this.getSettings(),
      this.balanceOf(sellerId),
      this.prisma.walletEntry.aggregate({ where: { sellerId, type: 'sale' }, _sum: { grossAmount: true, commission: true, amount: true }, _count: true }),
      this.prisma.walletEntry.aggregate({ where: { sellerId, type: 'refund' }, _sum: { grossAmount: true, commission: true, amount: true }, _count: true }),
      this.prisma.withdrawal.aggregate({ where: { sellerId, status: 'paid' }, _sum: { amount: true } }),
      this.prisma.withdrawal.findFirst({ where: { sellerId, status: 'pending' } }),
      this.prisma.walletEntry.findFirst({ where: { sellerId, availableAt: { gt: new Date() } }, orderBy: { availableAt: 'asc' } }),
      this.prisma.identityCheck.findFirst({ where: { sellerId }, orderBy: { createdAt: 'desc' }, select: { status: true, fullName: true } }),
    ]);

    const identityStatus = identity?.status ?? 'none';
    const withdrawable = Math.max(0, balance.available);
    const blocker =
      seller?.status !== 'approved'
        ? 'Votre compte vendeur doit être validé.'
        : identityStatus !== 'approved'
          ? 'Votre identité doit être vérifiée avant votre premier retrait.'
          : pendingWithdrawal
            ? 'Un retrait est déjà en cours de paiement.'
            : withdrawable < settings.minWithdrawal
              ? `Le retrait minimum est de ${fcfa(settings.minWithdrawal)}.`
              : null;

    return {
      balance: { ...balance, withdrawable },
      nextRelease: nextRelease ? { date: nextRelease.availableAt } : null,
      stats: {
        salesCount: sales._count - refunds._count,
        grossSales: (sales._sum.grossAmount ?? 0) + (refunds._sum.grossAmount ?? 0),
        commissions: (sales._sum.commission ?? 0) + (refunds._sum.commission ?? 0),
        netEarnings: (sales._sum.amount ?? 0) + (refunds._sum.amount ?? 0),
        withdrawn: paidOut._sum.amount ?? 0,
      },
      settings: WalletService.settingsView(settings),
      identity: { status: identityStatus, fullName: identity?.status === 'approved' ? identity.fullName : null },
      defaultPhone: seller?.phone ?? null,
      pendingWithdrawal: pendingWithdrawal ? WalletService.withdrawalView(pendingWithdrawal) : null,
      canWithdraw: blocker === null,
      blocker,
    };
  }

  /** Mouvements du vendeur, du plus récent au plus ancien (50 par page). */
  async entriesFor(sellerId: string, page = 1) {
    const take = 50;
    const [entries, total] = await Promise.all([
      this.prisma.walletEntry.findMany({
        where: { sellerId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: ENTRY_INCLUDE,
      }),
      this.prisma.walletEntry.count({ where: { sellerId } }),
    ]);
    const now = new Date();
    return {
      page,
      totalPages: Math.max(1, Math.ceil(total / take)),
      entries: entries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: e.amount,
        grossAmount: e.grossAmount,
        commission: e.commission,
        commissionRate: e.commissionRate !== null ? Number(e.commissionRate) : null,
        availableAt: e.availableAt,
        available: e.availableAt <= now,
        createdAt: e.createdAt,
        productName: e.orderItem?.product.name ?? null,
        orderNumber: e.orderItem?.order.orderNumber ?? null,
        withdrawal: e.withdrawal
          ? { operator: e.withdrawal.operator, phone: e.withdrawal.phone, status: e.withdrawal.status, reference: e.withdrawal.transferReference }
          : null,
      })),
    };
  }

  // ── Retraits (vendeur) ──────────────────────────────────────────────

  async withdrawalsFor(sellerId: string) {
    const withdrawals = await this.prisma.withdrawal.findMany({ where: { sellerId }, orderBy: { createdAt: 'desc' }, take: 100 });
    return withdrawals.map((w) => WalletService.withdrawalView(w));
  }

  async withdrawalFor(sellerId: string, withdrawalId: string) {
    const withdrawal = await this.prisma.withdrawal.findFirst({
      where: { id: withdrawalId, sellerId },
      include: { seller: { select: { firstName: true, lastName: true, email: true, store: { select: { name: true } } } } },
    });
    if (!withdrawal) {
      throw new NotFoundException('Retrait introuvable');
    }
    return { ...WalletService.withdrawalView(withdrawal), seller: withdrawal.seller };
  }

  /**
   * Demande de retrait : compte validé, identité vérifiée, un seul retrait en cours, montant au moins
   * égal au minimum, multiple de 5 et couvert par le solde retirable. Le vendeur est verrouillé le temps
   * de la vérification : deux demandes simultanées ne peuvent pas dépasser le solde.
   */
  async requestWithdrawal(sellerId: string, dto: RequestWithdrawalDto) {
    const phone = SellersService.normalizePhone(dto.phone);
    if (!/^\+2376\d{8}$/.test(phone)) {
      throw new BadRequestException('Indiquez un numéro Mobile Money camerounais (6XX XX XX XX)');
    }
    if (dto.amount % 5 !== 0) {
      throw new BadRequestException('Le montant doit être un multiple de 5 FCFA');
    }

    const withdrawal = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM sellers WHERE id = ${sellerId} FOR UPDATE`;
      const seller = await tx.seller.findUnique({ where: { id: sellerId }, select: { status: true } });
      const identity = await tx.identityCheck.findFirst({ where: { sellerId }, orderBy: { createdAt: 'desc' }, select: { status: true } });
      const pending = await tx.withdrawal.findFirst({ where: { sellerId, status: 'pending' }, select: { id: true } });
      const settings = await this.getSettings(tx);
      const balance = await this.balanceOf(sellerId, tx);
      if (seller?.status !== 'approved') {
        throw new ForbiddenException('Votre compte vendeur doit être validé pour retirer de l’argent');
      }
      if (identity?.status !== 'approved') {
        throw new ForbiddenException('Votre identité doit être vérifiée avant votre premier retrait');
      }
      if (pending) {
        throw new ConflictException('Un retrait est déjà en cours de paiement : attendez son traitement');
      }
      if (dto.amount > balance.available) {
        throw new BadRequestException(`Montant supérieur à votre solde retirable (${fcfa(Math.max(0, balance.available))})`);
      }
      if (dto.amount < settings.minWithdrawal) {
        throw new BadRequestException(`Le retrait minimum est de ${fcfa(settings.minWithdrawal)}`);
      }

      const created = await tx.withdrawal.create({
        data: { sellerId, amount: dto.amount, operator: dto.operator, phone, accountName: dto.accountName },
      });
      await tx.walletEntry.create({
        data: { sellerId, type: 'withdrawal', amount: -dto.amount, availableAt: new Date(), withdrawalId: created.id },
      });
      return created;
    });
    this.logger.log(`Retrait demandé : ${withdrawal.amount} FCFA (vendeur ${sellerId})`);
    return WalletService.withdrawalView(withdrawal);
  }

  /** Annulation par le vendeur d'un retrait pas encore payé : l'argent revient dans le solde. */
  async cancelWithdrawal(sellerId: string, withdrawalId: string) {
    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.withdrawal.updateMany({
        where: { id: withdrawalId, sellerId, status: 'pending' },
        data: { status: 'cancelled', processedAt: new Date() },
      });
      if (updated.count === 0) {
        throw new ConflictException('Ce retrait ne peut plus être annulé');
      }
      return this.reverse(tx, withdrawalId);
    });
    return WalletService.withdrawalView(withdrawal);
  }

  // ── Retraits (administration) ───────────────────────────────────────

  async listWithdrawals(status: WithdrawalStatus) {
    const withdrawals = await this.prisma.withdrawal.findMany({
      where: { status },
      orderBy: status === 'pending' ? { createdAt: 'asc' } : { processedAt: 'desc' },
      take: 200,
      include: WITHDRAWAL_ADMIN_INCLUDE,
    });
    return Promise.all(
      withdrawals.map(async (w) => ({
        ...WalletService.withdrawalView(w),
        seller: {
          id: w.seller.id,
          firstName: w.seller.firstName,
          lastName: w.seller.lastName,
          email: w.seller.email,
          phone: w.seller.phone,
          status: w.seller.status,
          store: w.seller.store,
          verifiedName: w.seller.identityChecks[0]?.fullName ?? null,
        },
        sellerBalance: await this.balanceOf(w.sellerId),
      })),
    );
  }

  /** « Payé » (avec la référence de l'envoi Mobile Money) ou refusé (motif ; l'argent revient au vendeur). */
  async handleWithdrawal(withdrawalId: string, action: 'paid' | 'reject', reference?: string | null, note?: string | null) {
    if (action === 'paid' && (reference?.trim().length ?? 0) < 3) {
      throw new BadRequestException('Indiquez la référence de la transaction Mobile Money');
    }
    if (action === 'reject' && (note?.trim().length ?? 0) < 5) {
      throw new BadRequestException('Indiquez le motif du refus (5 caractères au moins) : il sera envoyé au vendeur');
    }

    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.withdrawal.updateMany({
        where: { id: withdrawalId, status: 'pending' },
        data:
          action === 'paid'
            ? { status: 'paid', transferReference: reference!.trim(), processedAt: new Date() }
            : { status: 'rejected', adminNote: note!.trim(), processedAt: new Date() },
      });
      if (updated.count === 0) {
        const exists = await tx.withdrawal.findUnique({ where: { id: withdrawalId }, select: { id: true } });
        if (!exists) throw new NotFoundException('Retrait introuvable');
        throw new ConflictException('Ce retrait a déjà été traité');
      }
      return action === 'reject' ? this.reverse(tx, withdrawalId) : tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
    });

    const seller = await this.prisma.seller.findUnique({ where: { id: withdrawal.sellerId }, select: { email: true, firstName: true } });
    if (seller) {
      if (action === 'paid') {
        await this.emailService.sendSellerWithdrawalPaid(seller.email, seller.firstName, WalletService.withdrawalView(withdrawal));
      } else {
        await this.emailService.sendSellerWithdrawalRejected(seller.email, seller.firstName, withdrawal.amount, withdrawal.adminNote ?? '');
      }
    }
    this.logger.log(`Retrait ${withdrawalId} : ${action === 'paid' ? 'payé' : 'refusé'}`);
    return WalletService.withdrawalView(withdrawal);
  }

  /** Chiffres de la marketplace pour l'administrateur. */
  async adminSummary() {
    const [commissions, balances, pending, paid] = await Promise.all([
      this.prisma.walletEntry.aggregate({ where: { type: { in: ['sale', 'refund'] } }, _sum: { commission: true, grossAmount: true } }),
      this.prisma.walletEntry.aggregate({ _sum: { amount: true } }),
      this.prisma.withdrawal.aggregate({ where: { status: 'pending' }, _sum: { amount: true }, _count: true }),
      this.prisma.withdrawal.aggregate({ where: { status: 'paid' }, _sum: { amount: true } }),
    ]);
    return {
      grossSales: commissions._sum.grossAmount ?? 0,
      commissions: commissions._sum.commission ?? 0,
      // Argent dû aux vendeurs (retraits en cours non compris : ils sont déjà déduits des soldes).
      sellerBalances: balances._sum.amount ?? 0,
      pendingWithdrawals: { count: pending._count, amount: pending._sum.amount ?? 0 },
      paidOut: paid._sum.amount ?? 0,
    };
  }

  // ── Outils ──────────────────────────────────────────────────────────

  /** Restitue au vendeur le montant d'un retrait refusé ou annulé. */
  private async reverse(tx: Prisma.TransactionClient, withdrawalId: string) {
    const withdrawal = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
    await tx.walletEntry.create({
      data: { sellerId: withdrawal.sellerId, type: 'withdrawal_reversal', amount: withdrawal.amount, availableAt: new Date(), withdrawalId },
    });
    return withdrawal;
  }

  static withdrawalView(w: {
    id: string;
    amount: number;
    operator: string;
    phone: string;
    accountName: string;
    status: WithdrawalStatus;
    transferReference: string | null;
    adminNote: string | null;
    processedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: w.id,
      amount: w.amount,
      operator: w.operator,
      phone: w.phone,
      accountName: w.accountName,
      status: w.status,
      transferReference: w.transferReference,
      adminNote: w.adminNote,
      processedAt: w.processedAt,
      createdAt: w.createdAt,
    };
  }
}
