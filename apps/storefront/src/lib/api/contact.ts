import { getApiUrl } from '@/lib/env';
import { apiFetch, responseError } from './errors';

export type ContactTopic = 'order' | 'refund' | 'seller' | 'personal_data' | 'other';

export const CONTACT_TOPICS: { value: ContactTopic; label: string }[] = [
  { value: 'order', label: 'Commande ou téléchargement' },
  { value: 'refund', label: 'Demande de remboursement' },
  { value: 'personal_data', label: 'Données personnelles' },
  { value: 'seller', label: 'Je suis vendeur' },
  { value: 'other', label: 'Autre question' },
];

export interface ContactMessage {
  topic: ContactTopic;
  name: string;
  email: string;
  orderNumber: string;
  message: string;
  /** Champ piège, toujours vide pour un vrai visiteur. */
  website: string;
}

/** Envoie le message ; lève une erreur avec un texte lisible en cas de refus. */
export async function sendContactMessage(data: ContactMessage): Promise<string> {
  const res = await apiFetch(`${getApiUrl()}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 429) {
    throw new Error('Trop de messages envoyés depuis votre connexion : réessayez dans une heure.');
  }
  if (!res.ok) {
    throw await responseError(res, 'Envoi impossible pour le moment. Réessayez dans quelques minutes.');
  }
  const body = await res.json().catch(() => ({}));
  return body.message as string;
}
