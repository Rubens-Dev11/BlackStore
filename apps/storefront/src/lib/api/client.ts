import { getApiUrl } from '@/lib/env';
import { apiFetch, responseError } from './errors';

/** Espace client : connexion par lien e-mail, session gardée 30 jours dans ce navigateur. */

const STORAGE_KEY = 'blackstore-client-session';

export interface ClientSession {
  token: string;
  email: string;
  expiresAt: string;
}

export type DownloadState = 'valide' | 'introuvable' | 'annule' | 'expire' | 'quota' | 'verification' | 'indisponible';
export type DisputeStatus = 'open' | 'review' | 'accepted' | 'refunded' | 'rejected';

export interface ClientPurchases {
  email: string;
  orders: Array<{
    orderNumber: string;
    status: 'paid' | 'refunded';
    paidAt: string;
    totalAmount: number;
    items: Array<{
      id: string;
      productName: string;
      productSlug: string | null;
      store: { name: string; slug: string } | null;
      price: number;
      download: { token: string; etat: DownloadState; expiresAt: string; remaining: number; max: number } | null;
      dispute: { reference: string; status: DisputeStatus } | null;
      refundUntil: string | null;
    }>;
  }>;
}

/** La session n'est plus valable : il faut un nouveau lien de connexion. */
export class SessionExpiredError extends Error {}

export function loadSession(): ClientSession | null {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as ClientSession | null;
    if (!session?.token || new Date(session.expiresAt).getTime() < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: ClientSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Navigation privée : la session ne durera que le temps de la page.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // rien à effacer
  }
}

export async function requestLoginLink(email: string): Promise<string> {
  const res = await apiFetch(`${getApiUrl()}/client/lien`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (res.status === 429) {
    throw new Error('Trop de demandes depuis votre connexion : réessayez dans une heure.');
  }
  if (!res.ok) {
    throw await responseError(res, 'Le lien n’a pas pu être envoyé. Réessayez dans quelques minutes.');
  }
  return ((await res.json()) as { message: string }).message;
}

export async function openSession(jeton: string): Promise<ClientSession> {
  const res = await apiFetch(`${getApiUrl()}/client/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jeton }),
  });
  if (!res.ok) {
    throw await responseError(res, 'Ce lien de connexion ne fonctionne pas : demandez-en un nouveau.');
  }
  return res.json();
}

export async function fetchPurchases(token: string): Promise<ClientPurchases> {
  const res = await apiFetch(`${getApiUrl()}/client/achats`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (res.status === 401) {
    throw new SessionExpiredError('Votre session a expiré : demandez un nouveau lien de connexion.');
  }
  if (!res.ok) {
    throw await responseError(res, 'Vos achats n’ont pas pu être chargés. Réessayez.');
  }
  return res.json();
}

export async function closeSession(token: string): Promise<void> {
  await apiFetch(`${getApiUrl()}/client/deconnexion`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
}

/** Lien de téléchargement réel (l'API vérifie le lien puis envoie le fichier). */
export const downloadFileUrl = (token: string) => `${getApiUrl()}/downloads/${encodeURIComponent(token)}`;
