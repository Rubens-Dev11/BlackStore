import type { MobileMoneyOperator, WithdrawalStatus } from '@/lib/seller-api';

export type PeriodKey = '7j' | '30j' | '90j' | '12m';

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: '7j', label: '7 jours' },
  { key: '30j', label: '30 jours' },
  { key: '90j', label: '90 jours' },
  { key: '12m', label: '12 mois' },
];

export interface SellerStats {
  hasStore: boolean;
  store: { id: string; name: string; slug: string } | null;
  seller: { id: string; firstName: string; lastName: string; status: string };
  period: { key: PeriodKey; granularity: 'day' | 'month'; from: string; to: string };
  totals?: {
    views: number;
    visitors: number;
    productViews: number;
    storeViews: number;
    sales: number;
    freeItems: number;
    revenue: number;
    discounts: number;
    commission: number;
    net: number;
    refunds: number;
    refundedAmount: number;
    conversionRate: number;
  };
  previous?: { views: number; sales: number; revenue: number };
  series?: { bucket: string; views: number; sales: number; revenue: number }[];
  products?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    isActive: boolean;
    views: number;
    sales: number;
    freeItems: number;
    revenue: number;
    conversionRate: number;
  }[];
  sources?: { label: string; views: number; share: number }[];
}

export interface MonthlyReport {
  month: string;
  from: string;
  to: string;
  seller: { id: string; firstName: string; lastName: string; email: string };
  store: { id: string; name: string; slug: string } | null;
  sales: { date: string; orderNumber: string; productName: string; listPrice: number; discount: number; paid: number; commission: number | null; net: number | null }[];
  refunds: { date: string; orderNumber: string | null; productName: string | null; paid: number; commission: number; net: number }[];
  withdrawals: { id: string; date: string; processedAt: string | null; amount: number; status: WithdrawalStatus; operator: MobileMoneyOperator; reference: string | null }[];
  totals: { sales: number; listPrice: number; discounts: number; paid: number; commission: number; net: number; refunds: number; refundedNet: number; withdrawn: number };
  balance: { opening: number; closing: number };
}

export interface SellersRanking {
  period: { key: PeriodKey; from: string; to: string };
  totals: { sellersWithSales: number; sellersRevenue: number; commission: number; blackstoreRevenue: number };
  sellers: {
    sellerId: string | null;
    sellerName: string | null;
    sellerStatus: string | null;
    storeName: string;
    storeSlug: string | null;
    products: number;
    views: number;
    sales: number;
    revenue: number;
    commission: number;
    refunds: number;
  }[];
}

const TZ = 'Africa/Douala';

/** Case du graphique : « 9 oct. » (jour) ou « oct. 26 » (mois). */
export function bucketLabel(bucket: string, granularity: 'day' | 'month'): string {
  if (granularity === 'month') {
    return new Date(`${bucket}-15T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: TZ });
  }
  return new Date(`${bucket}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: TZ });
}

/** « 2026-10 » → « octobre 2026 ». */
export function monthLabel(month: string): string {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: TZ });
}

/** Les 12 derniers mois (le mois en cours d'abord), au format AAAA-MM. */
export function recentMonths(count = 12): string[] {
  const [year, month] = new Date().toLocaleDateString('en-CA', { timeZone: TZ }).split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1 - i, 15));
    return date.toISOString().slice(0, 7);
  });
}

export const formatDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });

/** Évolution par rapport à la période précédente : « +12 % », « −5 % », « nouveau » ou rien. */
export function trend(current: number, previous: number): { text: string; tone: 'up' | 'down' | 'flat' } | null {
  if (previous === 0) return current > 0 ? { text: 'nouveau', tone: 'up' } : null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return { text: '= stable', tone: 'flat' };
  return { text: `${change > 0 ? '+' : '−'}${Math.abs(change)} %`, tone: change > 0 ? 'up' : 'down' };
}

const WITHDRAWAL_LABELS: Record<WithdrawalStatus, string> = { pending: 'En cours', paid: 'Payé', rejected: 'Refusé', cancelled: 'Annulé' };

/** Relevé au format CSV (séparateur « ; », lisible par Excel en français et par Google Sheets). */
export function reportCsv(report: MonthlyReport): string {
  const cell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const line = (...values: (string | number | null | undefined)[]) => values.map(cell).join(';');
  const lines = [
    line('Relevé BlackStore', monthLabel(report.month)),
    line('Boutique', report.store?.name ?? ''),
    line('Vendeur', `${report.seller.firstName} ${report.seller.lastName}`),
    '',
    line('Ventes'),
    line('Date', 'Commande', 'Produit', 'Prix (FCFA)', 'Réduction (FCFA)', 'Payé par le client (FCFA)', 'Commission (FCFA)', 'Votre gain (FCFA)'),
    ...report.sales.map((s) => line(formatDay(s.date), s.orderNumber, s.productName, s.listPrice, s.discount, s.paid, s.commission, s.net)),
    '',
    line('Remboursements'),
    line('Date', 'Commande', 'Produit', 'Rendu au client (FCFA)', 'Commission annulée (FCFA)', 'Retiré de vos gains (FCFA)'),
    ...report.refunds.map((r) => line(formatDay(r.date), r.orderNumber, r.productName, r.paid, r.commission, r.net)),
    '',
    line('Retraits'),
    line('Date', 'Montant (FCFA)', 'Statut', 'Opérateur', 'Référence'),
    ...report.withdrawals.map((w) => line(formatDay(w.date), w.amount, WITHDRAWAL_LABELS[w.status], w.operator === 'orange' ? 'Orange Money' : 'MTN Mobile Money', w.reference)),
    '',
    line('Totaux'),
    line('Solde au début du mois (FCFA)', report.balance.opening),
    line('Ventes', report.totals.sales),
    line('Payé par les clients (FCFA)', report.totals.paid),
    line('dont réductions des codes promo (FCFA)', report.totals.discounts),
    line('Commission BlackStore (FCFA)', report.totals.commission),
    line('Vos gains sur les ventes (FCFA)', report.totals.net),
    line('Remboursements retirés de vos gains (FCFA)', report.totals.refundedNet),
    line('Retraits payés (FCFA)', report.totals.withdrawn),
    line('Solde à la fin du mois (FCFA)', report.balance.closing),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function downloadText(content: string, fileName: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
