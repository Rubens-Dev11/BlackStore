import { getApiUrl } from '@/lib/env';

export type ReportReason = 'piracy' | 'malware' | 'scam' | 'illegal' | 'broken' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'piracy', label: "Copie piratée, ou le vendeur n'a pas les droits" },
  { value: 'malware', label: 'Fichier dangereux (virus, logiciel malveillant)' },
  { value: 'scam', label: 'Arnaque ou produit trompeur' },
  { value: 'illegal', label: 'Contenu illégal, haineux ou choquant' },
  { value: 'broken', label: 'Fichier vide, illisible ou qui ne fonctionne pas' },
  { value: 'other', label: 'Autre problème' },
];

export async function submitReport(data: {
  productId: string;
  reason: ReportReason;
  details?: string;
  email?: string;
}): Promise<void> {
  const res = await fetch(`${getApiUrl()}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 429) {
    throw new Error('Vous avez envoyé beaucoup de signalements : réessayez dans une heure.');
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const message = Array.isArray(error.message) ? error.message[0] : error.message;
    throw new Error(message || 'Le signalement n’a pas pu être envoyé. Réessayez.');
  }
}
