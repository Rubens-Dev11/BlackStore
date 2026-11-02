import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma';
import { parseMonth, parsePeriod, StatsPeriod } from './stats-period';

/** Commandes qui comptent comme ventes : payées (et celles remboursées depuis, le remboursement apparaît à part). */
const SOLD = Prisma.sql`o.status IN ('paid', 'refunded')`;

/** Sites d'origine regroupés sous un nom lisible (« l.facebook.com » → « Facebook »). */
const SOURCE_NAMES: [RegExp, string][] = [
  [/(^|\.)facebook\.com$|^fb\.me$|^fb$|^facebook$/, 'Facebook'],
  [/(^|\.)instagram\.com$|^instagram$|^ig$/, 'Instagram'],
  [/(^|\.)whatsapp\.(com|net)$|^wa\.me$|^whatsapp$/, 'WhatsApp'],
  [/(^|\.)tiktok\.com$|^tiktok$/, 'TikTok'],
  [/(^|\.)google\.[a-z.]+$|^google$/, 'Google'],
  [/(^|\.)youtube\.com$|^youtu\.be$|^youtube$/, 'YouTube'],
  [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$|^twitter$|^x$/, 'X (Twitter)'],
  [/(^|\.)telegram\.(org|me)$|^t\.me$|^telegram$/, 'Telegram'],
  [/(^|\.)linkedin\.com$|^lnkd\.in$|^linkedin$/, 'LinkedIn'],
  [/(^|\.)bing\.com$|^bing$/, 'Bing'],
];
export const DIRECT_SOURCE = 'Accès direct ou inconnu';

export function sourceName(raw: string | null): string {
  if (!raw) return DIRECT_SOURCE;
  const value = raw.toLowerCase();
  return SOURCE_NAMES.find(([pattern]) => pattern.test(value))?.[1] ?? value;
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

interface StoreRef {
  storeId: string;
  sellerId: string;
}

/**
 * Statistiques d'un vendeur (vues, ventes, gains, produits, provenance des visiteurs) et relevé mensuel
 * de son compte. Les montants viennent des commandes (prix payé, réduction déduite) et du registre du
 * portefeuille (commission, remboursements, retraits), comme dans « Mes gains ».
 */
@Injectable()
export class SellerStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Boutique et identité d'un vendeur ; `store` est null s'il n'a pas encore de boutique. */
  async sellerWithStore(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { id: true, firstName: true, lastName: true, email: true, status: true, store: { select: { id: true, name: true, slug: true } } },
    });
    if (!seller) {
      throw new NotFoundException('Vendeur introuvable');
    }
    return seller;
  }

  // ─────────────────────────────────────────────
  // Tableau de bord
  // ─────────────────────────────────────────────

  async stats(sellerId: string, rawPeriod?: string) {
    const period = parsePeriod(rawPeriod);
    const seller = await this.sellerWithStore(sellerId);
    const head = {
      seller: { id: seller.id, firstName: seller.firstName, lastName: seller.lastName, status: seller.status },
      period: { key: period.key, granularity: period.granularity, from: period.from, to: period.to },
    };
    if (!seller.store) {
      return { hasStore: false as const, store: null, ...head };
    }
    const ref: StoreRef = { storeId: seller.store.id, sellerId: seller.id };
    const [views, sales, money, refunds, series, products, sources] = await Promise.all([
      this.viewTotals(ref, period),
      this.saleTotals(ref, period),
      this.moneyTotals(ref, period),
      this.refundTotals(ref, period),
      this.series(ref, period),
      this.products(ref, period),
      this.sources(ref, period),
    ]);
    return {
      hasStore: true as const,
      store: seller.store,
      ...head,
      totals: {
        views: views.views,
        visitors: views.visitors,
        productViews: views.productViews,
        storeViews: views.storeViews,
        sales: sales.sales,
        freeItems: sales.freeItems,
        revenue: sales.revenue,
        discounts: sales.discounts,
        commission: money.commission,
        net: money.net,
        refunds: refunds.count,
        refundedAmount: refunds.amount,
        conversionRate: percent(sales.sales + sales.freeItems, views.productViews),
      },
      previous: { views: views.previousViews, sales: sales.previousSales, revenue: sales.previousRevenue },
      series,
      products,
      sources,
    };
  }

  /** Vues des pages de la boutique et de ses produits. */
  private storeViews(ref: StoreRef) {
    return Prisma.sql`(pv.store_id = ${ref.storeId} OR pv.product_id IN (SELECT id FROM products WHERE store_id = ${ref.storeId}))`;
  }

  private async viewTotals(ref: StoreRef, period: StatsPeriod) {
    const [row] = await this.prisma.$queryRaw<
      { views: number; visitors: number; product_views: number; store_views: number; previous_views: number }[]
    >`
      SELECT count(*) FILTER (WHERE pv.created_at >= ${period.from})::int AS views,
             count(DISTINCT pv.ip_hash) FILTER (WHERE pv.created_at >= ${period.from})::int AS visitors,
             count(*) FILTER (WHERE pv.created_at >= ${period.from} AND pv.product_id IS NOT NULL)::int AS product_views,
             count(*) FILTER (WHERE pv.created_at >= ${period.from} AND pv.product_id IS NULL)::int AS store_views,
             count(*) FILTER (WHERE pv.created_at < ${period.from})::int AS previous_views
      FROM page_views pv
      WHERE pv.created_at >= ${period.previousFrom} AND pv.created_at < ${period.to} AND ${this.storeViews(ref)}`;
    return {
      views: row.views,
      visitors: row.visitors,
      productViews: row.product_views,
      storeViews: row.store_views,
      previousViews: row.previous_views,
    };
  }

  private async saleTotals(ref: StoreRef, period: StatsPeriod) {
    const [row] = await this.prisma.$queryRaw<
      { sales: number; free_items: number; revenue: number; discounts: number; previous_sales: number; previous_revenue: number }[]
    >`
      SELECT count(*) FILTER (WHERE o.paid_at >= ${period.from} AND oi.price_at_purchase > 0)::int AS sales,
             count(*) FILTER (WHERE o.paid_at >= ${period.from} AND oi.price_at_purchase = 0)::int AS free_items,
             coalesce(sum(oi.price_at_purchase) FILTER (WHERE o.paid_at >= ${period.from}), 0)::int AS revenue,
             coalesce(sum(oi.discount_amount) FILTER (WHERE o.paid_at >= ${period.from}), 0)::int AS discounts,
             count(*) FILTER (WHERE o.paid_at < ${period.from} AND oi.price_at_purchase > 0)::int AS previous_sales,
             coalesce(sum(oi.price_at_purchase) FILTER (WHERE o.paid_at < ${period.from}), 0)::int AS previous_revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE p.store_id = ${ref.storeId} AND ${SOLD} AND o.paid_at >= ${period.previousFrom} AND o.paid_at < ${period.to}`;
    return {
      sales: row.sales,
      freeItems: row.free_items,
      revenue: row.revenue,
      discounts: row.discounts,
      previousSales: row.previous_sales,
      previousRevenue: row.previous_revenue,
    };
  }

  /** Commission et gains des ventes payées sur la période (registre du portefeuille). */
  private async moneyTotals(ref: StoreRef, period: StatsPeriod) {
    const [row] = await this.prisma.$queryRaw<{ commission: number; net: number }[]>`
      SELECT coalesce(sum(w.commission), 0)::int AS commission, coalesce(sum(w.amount), 0)::int AS net
      FROM wallet_entries w
      JOIN order_items oi ON oi.id = w.order_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE w.type = 'sale' AND w.seller_id = ${ref.sellerId} AND o.paid_at >= ${period.from} AND o.paid_at < ${period.to}`;
    return row;
  }

  /** Remboursements accordés sur la période (prix payé rendu au client). */
  private async refundTotals(ref: StoreRef, period: StatsPeriod) {
    const [row] = await this.prisma.$queryRaw<{ count: number; amount: number }[]>`
      SELECT count(*)::int AS count, coalesce(-sum(w.gross_amount), 0)::int AS amount
      FROM wallet_entries w
      WHERE w.type = 'refund' AND w.seller_id = ${ref.sellerId} AND w.created_at >= ${period.from} AND w.created_at < ${period.to}`;
    return row;
  }

  private async series(ref: StoreRef, period: StatsPeriod) {
    const [views, sales] = await Promise.all([
      this.prisma.$queryRaw<{ bucket: string; views: number }[]>`
        SELECT to_char(pv.created_at + interval '1 hour', ${period.bucketFormat}) AS bucket, count(*)::int AS views
        FROM page_views pv
        WHERE pv.created_at >= ${period.from} AND pv.created_at < ${period.to} AND ${this.storeViews(ref)}
        GROUP BY 1`,
      this.prisma.$queryRaw<{ bucket: string; sales: number; revenue: number }[]>`
        SELECT to_char(o.paid_at + interval '1 hour', ${period.bucketFormat}) AS bucket,
               count(*) FILTER (WHERE oi.price_at_purchase > 0)::int AS sales,
               coalesce(sum(oi.price_at_purchase), 0)::int AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE p.store_id = ${ref.storeId} AND ${SOLD} AND o.paid_at >= ${period.from} AND o.paid_at < ${period.to}
        GROUP BY 1`,
    ]);
    return period.buckets.map((bucket) => ({
      bucket,
      views: views.find((v) => v.bucket === bucket)?.views ?? 0,
      sales: sales.find((s) => s.bucket === bucket)?.sales ?? 0,
      revenue: sales.find((s) => s.bucket === bucket)?.revenue ?? 0,
    }));
  }

  /** Tous les produits de la boutique, avec leurs vues et ventes sur la période. */
  private async products(ref: StoreRef, period: StatsPeriod) {
    const rows = await this.prisma.$queryRaw<
      { id: string; name: string; slug: string; price: number; is_active: boolean; views: number; sales: number; free_items: number; revenue: number }[]
    >`
      SELECT p.id, p.name, p.slug, p.price, p.is_active,
             coalesce(v.views, 0)::int AS views,
             coalesce(s.sales, 0)::int AS sales,
             coalesce(s.free_items, 0)::int AS free_items,
             coalesce(s.revenue, 0)::int AS revenue
      FROM products p
      LEFT JOIN (
        SELECT pv.product_id, count(*) AS views
        FROM page_views pv
        WHERE pv.created_at >= ${period.from} AND pv.created_at < ${period.to}
        GROUP BY pv.product_id
      ) v ON v.product_id = p.id
      LEFT JOIN (
        SELECT oi.product_id,
               count(*) FILTER (WHERE oi.price_at_purchase > 0) AS sales,
               count(*) FILTER (WHERE oi.price_at_purchase = 0) AS free_items,
               sum(oi.price_at_purchase) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE ${SOLD} AND o.paid_at >= ${period.from} AND o.paid_at < ${period.to}
        GROUP BY oi.product_id
      ) s ON s.product_id = p.id
      WHERE p.store_id = ${ref.storeId}
      ORDER BY revenue DESC, sales DESC, views DESC, p.name
      LIMIT 100`;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      price: row.price,
      isActive: row.is_active,
      views: row.views,
      sales: row.sales,
      freeItems: row.free_items,
      revenue: row.revenue,
      conversionRate: percent(row.sales + row.free_items, row.views),
    }));
  }

  /** D'où viennent les visiteurs : lien de campagne (utm_source) ou site d'origine, regroupés par nom. */
  private async sources(ref: StoreRef, period: StatsPeriod) {
    const rows = await this.prisma.$queryRaw<{ source: string | null; views: number }[]>`
      SELECT coalesce(nullif(pv.utm_source, ''), pv.referrer_host) AS source, count(*)::int AS views
      FROM page_views pv
      WHERE pv.created_at >= ${period.from} AND pv.created_at < ${period.to} AND ${this.storeViews(ref)}
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 100`;
    const grouped = new Map<string, number>();
    for (const row of rows) {
      const name = sourceName(row.source);
      grouped.set(name, (grouped.get(name) ?? 0) + row.views);
    }
    const total = rows.reduce((sum, row) => sum + row.views, 0);
    return [...grouped.entries()]
      .map(([label, views]) => ({ label, views, share: percent(views, total) }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);
  }

  // ─────────────────────────────────────────────
  // Classement des vendeurs (admin)
  // ─────────────────────────────────────────────

  /** Une ligne par boutique, plus une ligne pour les produits de BlackStore. */
  async ranking(rawPeriod?: string) {
    const period = parsePeriod(rawPeriod);
    const rows = await this.prisma.$queryRaw<
      {
        seller_id: string | null;
        first_name: string | null;
        last_name: string | null;
        status: string | null;
        store_name: string | null;
        store_slug: string | null;
        products: number;
        views: number;
        sales: number;
        revenue: number;
        commission: number;
        refunds: number;
      }[]
    >`
      WITH owners AS (
        SELECT st.id AS store_id, s.id AS seller_id, s.first_name, s.last_name, s.status::text AS status, st.name AS store_name, st.slug AS store_slug
        FROM stores st JOIN sellers s ON s.id = st.seller_id
        UNION ALL
        SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL
      ),
      views AS (
        SELECT coalesce(pv.store_id, p.store_id) AS store_id, count(*) AS views
        FROM page_views pv LEFT JOIN products p ON p.id = pv.product_id
        WHERE pv.created_at >= ${period.from} AND pv.created_at < ${period.to}
        GROUP BY 1
      ),
      sales AS (
        SELECT p.store_id, count(*) FILTER (WHERE oi.price_at_purchase > 0) AS sales, sum(oi.price_at_purchase) AS revenue
        FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
        WHERE ${SOLD} AND o.paid_at >= ${period.from} AND o.paid_at < ${period.to}
        GROUP BY p.store_id
      ),
      money AS (
        SELECT w.seller_id,
               sum(w.commission) FILTER (WHERE w.type = 'sale' AND o.paid_at >= ${period.from} AND o.paid_at < ${period.to}) AS commission,
               count(*) FILTER (WHERE w.type = 'refund' AND w.created_at >= ${period.from} AND w.created_at < ${period.to}) AS refunds
        FROM wallet_entries w
        LEFT JOIN order_items oi ON oi.id = w.order_item_id
        LEFT JOIN orders o ON o.id = oi.order_id
        WHERE w.type IN ('sale', 'refund')
        GROUP BY w.seller_id
      ),
      catalogue AS (
        SELECT store_id, count(*) AS products FROM products GROUP BY store_id
      )
      SELECT ow.seller_id, ow.first_name, ow.last_name, ow.status, ow.store_name, ow.store_slug,
             coalesce(c.products, 0)::int AS products,
             coalesce(v.views, 0)::int AS views,
             coalesce(sa.sales, 0)::int AS sales,
             coalesce(sa.revenue, 0)::int AS revenue,
             coalesce(m.commission, 0)::int AS commission,
             coalesce(m.refunds, 0)::int AS refunds
      FROM owners ow
      LEFT JOIN views v ON v.store_id IS NOT DISTINCT FROM ow.store_id
      LEFT JOIN sales sa ON sa.store_id IS NOT DISTINCT FROM ow.store_id
      LEFT JOIN money m ON m.seller_id = ow.seller_id
      LEFT JOIN catalogue c ON c.store_id IS NOT DISTINCT FROM ow.store_id
      ORDER BY revenue DESC, sales DESC, views DESC, ow.store_name NULLS FIRST`;
    const sellers = rows.map((row) => ({
      sellerId: row.seller_id,
      sellerName: row.seller_id ? `${row.first_name} ${row.last_name}` : null,
      sellerStatus: row.status,
      storeName: row.store_name ?? 'BlackStore',
      storeSlug: row.store_slug,
      products: row.products,
      views: row.views,
      sales: row.sales,
      revenue: row.revenue,
      commission: row.commission,
      refunds: row.refunds,
    }));
    const marketplace = sellers.filter((s) => s.sellerId);
    return {
      period: { key: period.key, from: period.from, to: period.to },
      totals: {
        sellersWithSales: marketplace.filter((s) => s.sales > 0).length,
        sellersRevenue: marketplace.reduce((sum, s) => sum + s.revenue, 0),
        commission: marketplace.reduce((sum, s) => sum + s.commission, 0),
        blackstoreRevenue: sellers.find((s) => !s.sellerId)?.revenue ?? 0,
      },
      sellers,
    };
  }

  // ─────────────────────────────────────────────
  // Relevé mensuel
  // ─────────────────────────────────────────────

  async monthlyReport(sellerId: string, rawMonth?: string) {
    const { month, from, to } = parseMonth(rawMonth);
    const seller = await this.sellerWithStore(sellerId);
    const [sales, refunds, withdrawals, opening, closing] = await Promise.all([
      this.prisma.$queryRaw<
        { paid_at: Date; order_number: string; product_name: string; paid: number; discount: number; commission: number | null; net: number | null }[]
      >`
        SELECT o.paid_at, o.order_number, p.name AS product_name, oi.price_at_purchase AS paid, oi.discount_amount AS discount,
               w.commission, w.amount AS net
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN wallet_entries w ON w.order_item_id = oi.id AND w.type = 'sale'
        WHERE p.store_id = ${seller.store?.id ?? null} AND ${SOLD} AND oi.price_at_purchase > 0
          AND o.paid_at >= ${from} AND o.paid_at < ${to}
        ORDER BY o.paid_at, o.order_number`,
      this.prisma.$queryRaw<
        { created_at: Date; order_number: string | null; product_name: string | null; gross: number; commission: number; net: number }[]
      >`
        SELECT w.created_at, o.order_number, p.name AS product_name,
               -coalesce(w.gross_amount, 0) AS gross, -coalesce(w.commission, 0) AS commission, -w.amount AS net
        FROM wallet_entries w
        LEFT JOIN order_items oi ON oi.id = w.order_item_id
        LEFT JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE w.type = 'refund' AND w.seller_id = ${sellerId} AND w.created_at >= ${from} AND w.created_at < ${to}
        ORDER BY w.created_at`,
      this.prisma.withdrawal.findMany({
        where: { sellerId, createdAt: { gte: from, lt: to } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true, processedAt: true, amount: true, status: true, operator: true, transferReference: true },
      }),
      this.prisma.walletEntry.aggregate({ where: { sellerId, createdAt: { lt: from } }, _sum: { amount: true } }),
      this.prisma.walletEntry.aggregate({ where: { sellerId, createdAt: { lt: to } }, _sum: { amount: true } }),
    ]);
    const sum = <T>(rows: T[], pick: (row: T) => number | null) => rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
    return {
      month,
      from,
      to,
      seller: { id: seller.id, firstName: seller.firstName, lastName: seller.lastName, email: seller.email },
      store: seller.store,
      sales: sales.map((s) => ({
        date: s.paid_at,
        orderNumber: s.order_number,
        productName: s.product_name,
        listPrice: s.paid + s.discount,
        discount: s.discount,
        paid: s.paid,
        commission: s.commission,
        net: s.net,
      })),
      refunds: refunds.map((r) => ({
        date: r.created_at,
        orderNumber: r.order_number,
        productName: r.product_name,
        paid: r.gross,
        commission: r.commission,
        net: r.net,
      })),
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        date: w.createdAt,
        processedAt: w.processedAt,
        amount: w.amount,
        status: w.status,
        operator: w.operator,
        reference: w.transferReference,
      })),
      totals: {
        sales: sales.length,
        listPrice: sum(sales, (s) => s.paid + s.discount),
        discounts: sum(sales, (s) => s.discount),
        paid: sum(sales, (s) => s.paid),
        commission: sum(sales, (s) => s.commission),
        net: sum(sales, (s) => s.net),
        refunds: refunds.length,
        refundedNet: sum(refunds, (r) => r.net),
        withdrawn: sum(withdrawals.filter((w) => w.status === 'paid'), (w) => w.amount),
      },
      balance: { opening: opening._sum.amount ?? 0, closing: closing._sum.amount ?? 0 },
    };
  }
}
