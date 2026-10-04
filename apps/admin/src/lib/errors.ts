/**
 * Messages d'erreur lisibles pour l'admin et l'espace vendeur : coupure réseau,
 * mise à jour du serveur (page de maintenance), limites, erreurs de validation.
 */

export const NETWORK_ERROR = 'Serveur injoignable. Vérifiez votre connexion internet, puis réessayez.';
export const MAINTENANCE_ERROR = 'BlackStore est en cours de mise à jour. Réessayez dans une minute.';
export const SERVER_ERROR = 'Erreur serveur. Réessayez.';

const STATUS_MESSAGES: Record<number, string> = {
  0: NETWORK_ERROR,
  413: 'Fichier ou contenu trop volumineux.',
  429: 'Trop de tentatives. Patientez quelques minutes avant de réessayer.',
  500: 'Erreur du serveur. Réessayez dans un instant.',
  502: MAINTENANCE_ERROR,
  503: MAINTENANCE_ERROR,
  504: MAINTENANCE_ERROR,
};

/** Message par défaut d'un code HTTP (undefined si aucun). */
export const statusMessage = (status: number | undefined): string | undefined =>
  status === undefined ? undefined : STATUS_MESSAGES[status];

/**
 * Message d'une réponse refusée : celui de l'API (texte, ou liste pour les
 * erreurs de validation), sinon celui du code HTTP (page HTML du serveur
 * pendant une mise à jour, par exemple).
 */
export async function responseMessage(response: Response): Promise<string | string[]> {
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
  const message = body?.message;
  if (Array.isArray(message) && message.length > 0) return message as string[];
  if (typeof message === 'string' && message.trim()) return message;
  return statusMessage(response.status) ?? SERVER_ERROR;
}

/** Paramètre ajouté à l'adresse de connexion quand la session a expiré. */
export const SESSION_EXPIRED_PARAM = 'session=expiree';
