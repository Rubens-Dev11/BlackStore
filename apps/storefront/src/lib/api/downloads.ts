import { getApiUrl, getServerApiUrl } from '@/lib/env';

/** État d'un lien de téléchargement, tel que l'API le décrit (sans compter de téléchargement). */
export type DownloadState = 'valide' | 'introuvable' | 'annule' | 'expire' | 'quota' | 'verification' | 'indisponible';

export interface DownloadStatus {
  etat: DownloadState;
  produit?: string;
  commande?: string;
  expireLe?: string;
  telechargementsRestants?: number;
  telechargementsMax?: number;
}

/** Lu côté serveur ; une panne de l'API lève une erreur (page « Réessayer »). */
export async function fetchDownloadStatus(token: string): Promise<DownloadStatus> {
  const res = await fetch(`${getServerApiUrl()}/downloads/${encodeURIComponent(token)}/etat`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`État du lien indisponible (erreur ${res.status})`);
  return res.json();
}

/** Lien de téléchargement réel (l'API vérifie le lien puis envoie le fichier). */
export const downloadFileUrl = (token: string) => `${getApiUrl()}/downloads/${encodeURIComponent(token)}`;
