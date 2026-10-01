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
}

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
