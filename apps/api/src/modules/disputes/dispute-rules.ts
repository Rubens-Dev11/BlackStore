import { DisputeReason, DisputeStatus, MobileMoneyOperator } from '@prisma/client';

// Règles de la politique de remboursement publiée (page /remboursements) : délais et cas remboursés.

/** Jours laissés au vendeur pour répondre ou corriger son produit. */
export const SELLER_RESPONSE_DAYS = 5;
/** Jours après l'achat pour demander un remboursement (30 pour un double paiement). */
export const REQUEST_WINDOW_DAYS = 7;
export const DOUBLE_PAYMENT_WINDOW_DAYS = 30;

/** Litiges en cours : le montant de la vente reste bloqué chez le vendeur. */
export const BLOCKING_DISPUTE_STATUSES: DisputeStatus[] = ['open', 'review'];

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  unusable: 'Produit inutilisable',
  not_as_described: 'Produit non conforme à sa description',
  not_received: 'Produit non reçu',
  double_payment: 'Double paiement',
  removed: 'Produit retiré du site après l’achat',
};

export const OPERATOR_LABELS: Record<MobileMoneyOperator, string> = {
  orange: 'Orange Money',
  mtn: 'MTN Mobile Money',
};

const DAY_MS = 24 * 3600 * 1000;

/** Date limite de la demande, selon le motif. */
export function requestDeadline(paidAt: Date, reason: DisputeReason | null): Date {
  const days = reason === 'double_payment' ? DOUBLE_PAYMENT_WINDOW_DAYS : REQUEST_WINDOW_DAYS;
  return new Date(paidAt.getTime() + days * DAY_MS);
}

export function sellerDeadlineFrom(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SELLER_RESPONSE_DAYS * DAY_MS);
}

/** Nom montré au vendeur : prénom et initiale (« Awa C. »), jamais l'e-mail ni le téléphone. */
export function buyerPublicName(fullName: string): string {
  const [first, second] = fullName.trim().split(/\s+/);
  if (!first) return 'Acheteur';
  return second ? `${first} ${second[0].toUpperCase()}.` : first;
}

/** Date et heure du Cameroun : « 9 octobre 2026 à 14:05 ». */
export const formatDoualaDate = (date: Date) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Douala',
  }).format(date);
