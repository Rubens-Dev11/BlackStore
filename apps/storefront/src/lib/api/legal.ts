import { getServerApiUrl } from '@/lib/env';

/** Informations des pages légales : éditeur, contact, hébergeur, règles de la marketplace. */
export interface LegalInfo {
  version: string;
  operator: { name: string | null; form: string | null; address: string | null; rccm: string | null; niu: string | null };
  contact: { email: string | null; phone: string | null };
  hosting: string | null;
  marketplace: { commissionRate: number; holdDays: number; minWithdrawal: number };
  urls: { storefront: string; sellerApp: string };
}

/** Valeurs de repli si l'API ne répond pas : les pages restent lisibles. */
const FALLBACK: LegalInfo = {
  version: '2026-10-04',
  operator: { name: null, form: null, address: null, rccm: null, niu: null },
  contact: { email: null, phone: null },
  hosting: null,
  marketplace: { commissionRate: 10, holdDays: 7, minWithdrawal: 5000 },
  urls: { storefront: 'https://blackstore.pymail.cm', sellerApp: 'https://admin.blackstore.pymail.cm' },
};

export async function fetchLegalInfo(): Promise<LegalInfo> {
  try {
    const res = await fetch(`${getServerApiUrl()}/legal`, { cache: 'no-store' });
    if (!res.ok) return FALLBACK;
    return (await res.json()) as LegalInfo;
  } catch {
    return FALLBACK;
  }
}

/** « 2026-10-04 » → « 4 octobre 2026 ». */
export function formatLegalDate(version: string): string {
  const date = new Date(`${version}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? version : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Nom de l'exploitant tel qu'il apparaît dans les textes. */
export function operatorName(info: LegalInfo): string {
  return info.operator.name ?? 'l’exploitant de BlackStore';
}

/** Lien WhatsApp (wa.me attend le numéro international sans « + » ni espaces). */
export function whatsappUrl(phone: string | null): string | null {
  return phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null;
}
