/**
 * Messages d'erreur lisibles pour les appels du navigateur vers l'API :
 * coupure réseau, mise à jour en cours (page de maintenance du serveur),
 * erreurs de validation (liste de messages).
 */

export const NETWORK_ERROR = 'Impossible de joindre BlackStore. Vérifiez votre connexion internet, puis réessayez.';
export const MAINTENANCE_ERROR = 'BlackStore est en cours de mise à jour. Réessayez dans une minute.';

const STATUS_MESSAGES: Record<number, string> = {
  413: 'Contenu trop volumineux.',
  429: 'Trop de tentatives. Patientez quelques minutes avant de réessayer.',
  500: 'Une erreur est survenue de notre côté. Réessayez dans un instant.',
  502: MAINTENANCE_ERROR,
  503: MAINTENANCE_ERROR,
  504: MAINTENANCE_ERROR,
};

/** fetch() dont la coupure réseau devient une erreur en français. */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(NETWORK_ERROR);
  }
}

/** Erreur à afficher pour une réponse refusée par l'API (ou par le serveur pendant une mise à jour). */
export async function responseError(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  const message = Array.isArray(body?.message) ? body?.message[0] : body?.message;
  if (typeof message === 'string' && message.trim()) return new Error(message);
  return new Error(STATUS_MESSAGES[res.status] ?? fallback);
}
