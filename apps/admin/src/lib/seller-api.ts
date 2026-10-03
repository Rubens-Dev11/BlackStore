import { getApiUrl } from './env';

export type SellerStatus = 'pending' | 'approved' | 'suspended';

export interface SellerProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: SellerStatus;
  emailVerifiedAt: string | null;
  statusChangedAt: string | null;
  lastLogin: string | null;
  createdAt: string;
  store: { name: string; slug: string } | null;
  /** Dernière vérification d'identité (vide si le vendeur n'a rien envoyé). */
  identityChecks: { status: IdentityCheckStatus; reviewedAt: string | null }[];
}

export type IdentityCheckStatus = 'pending' | 'approved' | 'rejected';
export type IdentityDocumentType = 'cni' | 'passport';

/** État de la vérification d'identité, vu par le vendeur. */
export interface SellerIdentity {
  status: IdentityCheckStatus | 'none';
  documentType: IdentityDocumentType | null;
  fullName: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export const IDENTITY_STATUS_LABELS: Record<IdentityCheckStatus | 'none', { label: string; tone: 'gray' | 'yellow' | 'green' | 'red' }> = {
  none: { label: 'Non envoyée', tone: 'gray' },
  pending: { label: 'À vérifier', tone: 'yellow' },
  approved: { label: 'Vérifiée', tone: 'green' },
  rejected: { label: 'Refusée', tone: 'red' },
};

/** Photos de la pièce et selfie : 8 Mo au plus chacune (même limite que l'API). */
export const IDENTITY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export interface SellerStore {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  whatsapp: string | null;
  logoUrl: string | null;
  /** Adresse publique de la boutique sur le site. */
  publicUrl: string;
}

/** Adresse de boutique proposée à partir de son nom : « Awa Digital » → « awa-digital ». */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

export interface SellerTokens {
  accessToken: string;
  refreshToken: string;
}

/** Erreur d'une page publique vendeur : message affichable + code éventuel (ex. EMAIL_NOT_VERIFIED). */
export class SellerApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

const DEFAULT_MESSAGES: Record<number, string> = {
  429: 'Trop de tentatives. Réessayez dans une minute.',
  500: 'Erreur serveur. Réessayez.',
};

/**
 * Appel des routes publiques /seller/auth/* (inscription, connexion, liens reçus
 * par e-mail). Le cookie de session vendeur est accepté (credentials: include).
 */
export async function sellerAuthRequest<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}/seller/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  } catch {
    throw new SellerApiError(0, 'Serveur injoignable. Vérifiez votre connexion internet.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Les erreurs de validation arrivent sous forme de liste de messages.
    const message = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new SellerApiError(res.status, DEFAULT_MESSAGES[res.status] ?? message ?? 'Erreur. Réessayez.', data.code);
  }
  return data as T;
}

// ── Produits des vendeurs ───────────────────────────────────────────────

export type ProductReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type FileScanStatus = 'pending' | 'clean' | 'infected' | 'failed';
export type ProductPlatform = 'android' | 'desktop' | 'multiplatform';

export interface SellerProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  originalPrice: number | null;
  categoryId: string | null;
  categoryName: string | null;
  platform: ProductPlatform;
  version: string | null;
  tags: string[];
  coverUrl: string | null;
  screenshotUrls: string[];
  file: { name: string; sizeMb: number | null } | null;
  scanStatus: FileScanStatus | null;
  /** Nom de la menace quand l'antivirus a refusé le fichier. */
  scanThreat: string | null;
  reviewStatus: ProductReviewStatus;
  /** Motif d'un refus par l'administrateur. */
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  isActive: boolean;
  /** Visible et achetable sur le site en ce moment. */
  isPublic: boolean;
  publicUrl: string;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
}

export const PLATFORM_LABELS: Record<ProductPlatform, string> = {
  android: 'Android',
  desktop: 'Ordinateur (Windows, Mac)',
  multiplatform: 'Tous les appareils',
};

/** Fichier du produit : 450 Mo au plus (même limite que l'API). */
export const SELLER_FILE_MAX_BYTES = 450 * 1024 * 1024;
export const SELLER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const SELLER_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Étiquette d'état d'un produit, du point de vue du vendeur. */
export function sellerProductState(p: SellerProduct): { label: string; tone: 'gray' | 'yellow' | 'green' | 'red' | 'blue' } {
  if (p.scanStatus === 'infected') return { label: "Fichier refusé par l'antivirus", tone: 'red' };
  if (p.reviewStatus === 'draft') return { label: 'Brouillon', tone: 'gray' };
  if (p.reviewStatus === 'pending') return { label: 'En attente de validation', tone: 'yellow' };
  if (p.reviewStatus === 'rejected') return { label: 'Refusé', tone: 'red' };
  if (p.scanStatus === 'pending') return { label: 'Analyse du nouveau fichier', tone: 'blue' };
  if (!p.isActive) return { label: 'Masqué', tone: 'gray' };
  return p.isPublic ? { label: 'En ligne', tone: 'green' } : { label: 'Validé', tone: 'green' };
}

export const TONE_CLASSES: Record<'gray' | 'yellow' | 'green' | 'red' | 'blue', string> = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
  green: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
  red: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
};

// ── Portefeuille ────────────────────────────────────────────────────────

export type MobileMoneyOperator = 'orange' | 'mtn';
export type WithdrawalStatus = 'pending' | 'paid' | 'rejected' | 'cancelled';

export const OPERATOR_LABELS: Record<MobileMoneyOperator, string> = {
  orange: 'Orange Money',
  mtn: 'MTN Mobile Money',
};

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, { label: string; tone: 'gray' | 'yellow' | 'green' | 'red' }> = {
  pending: { label: 'En cours de paiement', tone: 'yellow' },
  paid: { label: 'Payé', tone: 'green' },
  rejected: { label: 'Refusé', tone: 'red' },
  cancelled: { label: 'Annulé', tone: 'gray' },
};

export interface Withdrawal {
  id: string;
  amount: number;
  operator: MobileMoneyOperator;
  phone: string;
  accountName: string;
  status: WithdrawalStatus;
  transferReference: string | null;
  adminNote: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface MarketplaceSettings {
  commissionRate: number;
  holdDays: number;
  minWithdrawal: number;
  updatedAt?: string;
}

export interface WalletSummary {
  balance: { available: number; pending: number; total: number; withdrawable: number };
  nextRelease: { date: string } | null;
  stats: { salesCount: number; grossSales: number; commissions: number; netEarnings: number; withdrawn: number };
  settings: MarketplaceSettings;
  identity: { status: IdentityCheckStatus | 'none'; fullName: string | null };
  defaultPhone: string | null;
  pendingWithdrawal: Withdrawal | null;
  canWithdraw: boolean;
  /** Ce qui empêche un retrait (null si rien). */
  blocker: string | null;
}

export type WalletEntryType = 'sale' | 'refund' | 'withdrawal' | 'withdrawal_reversal';

export interface WalletEntry {
  id: string;
  type: WalletEntryType;
  amount: number;
  grossAmount: number | null;
  commission: number | null;
  commissionRate: number | null;
  availableAt: string;
  available: boolean;
  createdAt: string;
  productName: string | null;
  orderNumber: string | null;
  withdrawal: { operator: MobileMoneyOperator; phone: string; status: WithdrawalStatus; reference: string | null } | null;
}
