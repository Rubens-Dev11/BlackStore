import { getApiUrl } from '@/lib/env';

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
  const res = await fetch(`${getApiUrl()}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 429) {
    throw new Error('Trop de messages envoyés depuis votre connexion : réessayez dans une heure.');
  }
  if (!res.ok) {
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new Error(message || 'Envoi impossible pour le moment. Réessayez dans quelques minutes.');
  }
  return body.message as string;
}
