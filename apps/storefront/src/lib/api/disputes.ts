import { getApiUrl } from '@/lib/env';
import { apiFetch, responseError } from './errors';

/** Motifs de remboursement de la politique publiée (page /remboursements). */
export type DisputeReason = 'unusable' | 'not_as_described' | 'not_received' | 'double_payment' | 'removed';
export type MobileMoneyOperator = 'orange' | 'mtn';

export const DISPUTE_REASONS: { value: DisputeReason; label: string; hint: string }[] = [
  {
    value: 'unusable',
    label: 'Produit inutilisable',
    hint: 'Fichier vide, abîmé, ou qui ne fonctionne pas sur un appareil prévu par la configuration requise.',
  },
  { value: 'not_as_described', label: 'Produit non conforme', hint: 'Très différent de sa description : contenu manquant, mauvaise version, mauvaise langue…' },
  { value: 'not_received', label: 'Produit non reçu', hint: 'Liens jamais reçus, ou qui ne fonctionnent pas.' },
  { value: 'double_payment', label: 'Double paiement', hint: 'Vous avez payé deux fois cette commande (demande possible pendant 30 jours).' },
  { value: 'removed', label: 'Produit retiré', hint: 'Le produit a été retiré du site après votre achat (piraté ou dangereux).' },
];

export interface DisputableOrder {
  orderNumber: string;
  paidAt: string;
  deadline: string;
  doublePaymentDeadline: string;
  /** Délai de 7 jours encore ouvert. */
  open: boolean;
  /** Délai de 30 jours (double paiement) encore ouvert. */
  openForDoublePayment: boolean;
  items: Array<{
    id: string;
    productName: string;
    price: number;
    dispute: { reference: string; status: string } | null;
    /** Raison pour laquelle aucune demande n'est possible pour ce produit. */
    blocker: string | null;
  }>;
}

export interface NewDispute {
  orderNumber: string;
  email: string;
  orderItemId: string;
  reason: DisputeReason;
  description: string;
  refundOperator: MobileMoneyOperator;
  refundPhone: string;
  refundAccountName: string;
  website: string;
}

/** Retrouve la commande (numéro + e-mail utilisé à l'achat) ; POST pour que l'e-mail ne figure pas dans l'adresse. */
export async function findDisputableOrder(orderNumber: string, email: string): Promise<DisputableOrder> {
  const res = await apiFetch(`${getApiUrl()}/disputes/commande`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNumber, email }),
  });
  if (res.status === 429) {
    throw new Error('Trop de recherches depuis votre connexion : réessayez dans une heure.');
  }
  if (!res.ok) {
    throw await responseError(res, 'Commande introuvable pour le moment. Réessayez.');
  }
  return res.json();
}

export async function createDispute(data: NewDispute): Promise<{ reference: string | null; message: string; withSeller: boolean }> {
  const res = await apiFetch(`${getApiUrl()}/disputes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 429) {
    throw new Error('Trop de demandes envoyées depuis votre connexion : réessayez dans une heure.');
  }
  if (!res.ok) {
    throw await responseError(res, 'La demande n’a pas pu être envoyée. Réessayez dans quelques minutes.');
  }
  return res.json();
}
