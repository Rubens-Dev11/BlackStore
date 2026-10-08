import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, PromoCode } from '@prisma/client';
import { PrismaService } from '@/prisma';
import { PUBLIC_PRODUCT_WHERE } from '../products/product-visibility';
import { ApplyPromoCodeDto, CreatePromoCodeDto, UpdatePromoCodeDto } from './dto/promo-code.dto';
import { computeDiscounts, MIN_PAYABLE_AMOUNT, normalizePromoCode, PENDING_HOLD_MS, promoLabel } from './promo-rules';

/** Plafond de codes par boutique (et pour BlackStore). */
const MAX_CODES_PER_OWNER = 100;
const UNKNOWN_CODE = 'Ce code promo n’existe pas ou n’est plus actif.';

type Db = Prisma.TransactionClient | PrismaService;

/** Un article de commande (une unité), tel que le code le voit. */
export interface PromoUnit {
  productId: string;
  price: number;
  storeId: string | null;
}

const frenchDate = (date: Date) =>
  date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Douala' });

/** Commandes qui « consomment » un code : payées, remboursées, ou en attente de paiement depuis peu. */
const usedWhere = (promoCodeId: string): Prisma.OrderWhereInput => ({
  promoCodeId,
  OR: [
    { status: { in: ['paid', 'refunded'] } },
    { status: 'pending', createdAt: { gt: new Date(Date.now() - PENDING_HOLD_MS) } },
  ],
});

/**
 * Codes promo : un vendeur gère ceux de sa boutique, l'admin ceux de BlackStore. Un code ne réduit que
 * les produits de son propriétaire ; la réduction est déduite du prix payé de chaque article, donc des
 * gains du vendeur (la commission porte sur le prix payé).
 */
@Injectable()
export class PromoCodesService {
  private readonly logger = new Logger(PromoCodesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // Gestion (storeId = boutique du vendeur, null = BlackStore)
  // ─────────────────────────────────────────────

  async storeOfSeller(sellerId: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.store.findUnique({ where: { sellerId }, select: { id: true, name: true } });
  }

  async list(storeId: string | null) {
    const codes = await this.prisma.promoCode.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' } });
    const stats = codes.length
      ? await this.prisma.order.groupBy({
          by: ['promoCodeId'],
          where: { promoCodeId: { in: codes.map((c) => c.id) }, status: { in: ['paid', 'refunded'] } },
          _count: { _all: true },
          _sum: { discountAmount: true },
        })
      : [];
    const now = Date.now();
    return codes.map((code) => {
      const stat = stats.find((s) => s.promoCodeId === code.id);
      return {
        ...this.view(code),
        uses: stat?._count._all ?? 0,
        discountGiven: stat?._sum.discountAmount ?? 0,
        expired: !!code.expiresAt && code.expiresAt.getTime() <= now,
      };
    });
  }

  async create(storeId: string | null, dto: CreatePromoCodeDto) {
    this.checkValue(dto.discountType, dto.value);
    const expiresAt = dto.expiresAt ? this.futureDate(dto.expiresAt) : null;
    if ((await this.prisma.promoCode.count({ where: { storeId } })) >= MAX_CODES_PER_OWNER) {
      throw new ConflictException(`Vous avez déjà ${MAX_CODES_PER_OWNER} codes promo : supprimez ceux qui ne servent plus.`);
    }
    if (await this.prisma.promoCode.findUnique({ where: { code: dto.code }, select: { id: true } })) {
      throw new ConflictException('Ce code existe déjà sur BlackStore : choisissez-en un autre.');
    }
    const code = await this.prisma.promoCode.create({
      data: {
        code: dto.code,
        storeId,
        discountType: dto.discountType,
        value: dto.value,
        maxUses: dto.maxUses ?? null,
        oncePerCustomer: dto.oncePerCustomer ?? false,
        expiresAt,
      },
    });
    this.logger.log(`Code promo ${code.code} créé (${storeId ? `boutique ${storeId}` : 'BlackStore'})`);
    return { ...this.view(code), uses: 0, discountGiven: 0, expired: false };
  }

  async update(storeId: string | null, id: string, dto: UpdatePromoCodeDto) {
    await this.owned(storeId, id);
    const data: Prisma.PromoCodeUpdateInput = {};
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.maxUses !== undefined) data.maxUses = dto.maxUses;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt === null ? null : this.futureDate(dto.expiresAt);
    await this.prisma.promoCode.update({ where: { id }, data });
    return (await this.list(storeId)).find((c) => c.id === id);
  }

  /** Un code qui a servi reste dans l'historique des commandes : on le désactive au lieu de le supprimer. */
  async remove(storeId: string | null, id: string) {
    await this.owned(storeId, id);
    if (await this.prisma.order.count({ where: { promoCodeId: id } })) {
      throw new ConflictException('Ce code a déjà servi dans une commande : désactivez-le plutôt.');
    }
    await this.prisma.promoCode.delete({ where: { id } });
    return { message: 'Code promo supprimé' };
  }

  // ─────────────────────────────────────────────
  // Application à un panier ou à une commande
  // ─────────────────────────────────────────────

  /** Aperçu de la réduction sur le panier, sans rien réserver. */
  async preview(dto: ApplyPromoCodeDto) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) }, ...PUBLIC_PRODUCT_WHERE },
      select: { id: true, price: true, storeId: true },
    });
    const units: PromoUnit[] = [];
    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      for (let i = 0; i < item.quantity; i++) units.push({ productId: product.id, price: product.price, storeId: product.storeId });
    }
    const { promo, discounts } = await this.evaluate(this.prisma, dto.code, dto.email, units);
    const subtotal = units.reduce((sum, u) => sum + u.price, 0);
    const discount = discounts.reduce((sum, d) => sum + d, 0);
    const discountByProduct: Record<string, number> = {};
    units.forEach((u, i) => {
      if (discounts[i]) discountByProduct[u.productId] = (discountByProduct[u.productId] ?? 0) + discounts[i];
    });
    return {
      code: promo.code,
      label: promoLabel(promo),
      storeName: promo.store?.name ?? null,
      oncePerCustomer: promo.oncePerCustomer,
      subtotal,
      discount,
      total: subtotal - discount,
      discountByProduct,
    };
  }

  /**
   * Dans la transaction de création de la commande : le code est verrouillé (FOR UPDATE) le temps de
   * compter ses utilisations, pour que deux commandes simultanées ne dépassent pas la limite.
   */
  async applyToOrder(tx: Prisma.TransactionClient, rawCode: string, email: string, units: PromoUnit[]) {
    const { promo, discounts } = await this.evaluate(tx, rawCode, email, units, true);
    return { promoCodeId: promo.id, promoCodeText: promo.code, discounts };
  }

  private async evaluate(db: Db, rawCode: string, email: string | undefined, units: PromoUnit[], lock = false) {
    const code = normalizePromoCode(rawCode);
    const promo = await db.promoCode.findUnique({ where: { code }, include: { store: { select: { name: true } } } });
    if (!promo || !promo.isActive) {
      throw new BadRequestException(UNKNOWN_CODE);
    }
    if (lock) {
      await db.$queryRaw`SELECT id FROM promo_codes WHERE id = ${promo.id} FOR UPDATE`;
    }
    if (promo.expiresAt && promo.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(`Ce code promo a expiré le ${frenchDate(promo.expiresAt)}.`);
    }
    const eligible = units.map((u) => u.storeId === promo.storeId && u.price > 0);
    if (!eligible.some(Boolean)) {
      throw new BadRequestException(
        promo.store
          ? `Ce code promo ne vaut que pour les produits de la boutique « ${promo.store.name} ».`
          : 'Ce code promo ne vaut que pour les produits vendus par BlackStore.',
      );
    }
    if (promo.maxUses !== null && (await db.order.count({ where: usedWhere(promo.id) })) >= promo.maxUses) {
      throw new ConflictException('Ce code promo a déjà été utilisé autant de fois que prévu.');
    }
    if (promo.oncePerCustomer && email) {
      const already = await db.order.count({
        where: { ...usedWhere(promo.id), buyerEmail: { equals: email.trim(), mode: 'insensitive' } },
      });
      if (already) {
        throw new ConflictException('Vous avez déjà utilisé ce code promo : il ne sert qu’une fois par client.');
      }
    }
    const discounts = computeDiscounts(promo, units.map((u, i) => ({ price: u.price, eligible: eligible[i] })));
    const total = units.reduce((sum, u, i) => sum + u.price - discounts[i], 0);
    if (total > 0 && total < MIN_PAYABLE_AMOUNT) {
      throw new BadRequestException(
        `Après réduction, il resterait ${total} FCFA à payer : le paiement Mobile Money demande au moins ${MIN_PAYABLE_AMOUNT} FCFA.`,
      );
    }
    return { promo, discounts };
  }

  // ─────────────────────────────────────────────
  // Outils
  // ─────────────────────────────────────────────

  private view(code: PromoCode) {
    return {
      id: code.id,
      code: code.code,
      discountType: code.discountType,
      value: code.value,
      label: promoLabel(code),
      maxUses: code.maxUses,
      oncePerCustomer: code.oncePerCustomer,
      expiresAt: code.expiresAt,
      isActive: code.isActive,
      createdAt: code.createdAt,
    };
  }

  private async owned(storeId: string | null, id: string) {
    const code = await this.prisma.promoCode.findFirst({ where: { id, storeId }, select: { id: true } });
    if (!code) {
      throw new NotFoundException('Code promo introuvable');
    }
  }

  private checkValue(type: 'percent' | 'amount', value: number) {
    if (type === 'percent' && value > 100) {
      throw new BadRequestException('Une réduction en pourcentage va de 1 à 100 %.');
    }
    if (type === 'amount' && (value < 5 || value % 5 !== 0)) {
      throw new BadRequestException('Une réduction en montant est un multiple de 5 FCFA (5, 10, 500…).');
    }
  }

  private futureDate(iso: string): Date {
    const date = new Date(iso);
    if (date.getTime() <= Date.now()) {
      throw new BadRequestException('La date de fin est déjà passée.');
    }
    return date;
  }
}
