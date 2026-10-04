import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Informations publiques des pages légales (même réponse que pour le site). */
export interface PublicLegalInfo {
  version: string;
  urls: { storefront: string; sellerApp: string };
}

/** Identité de l'éditeur et contact, modifiables dans « Réglages ». */
export interface LegalSettings {
  legalName: string | null;
  legalForm: string | null;
  legalAddress: string | null;
  rccm: string | null;
  niu: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  hostingInfo: string | null;
  updatedAt: string;
}

/** Adresse du site (pour les liens vers les conditions), lue une fois auprès de l'API. */
export function useStorefrontUrl(): string {
  const { data } = useQuery({
    queryKey: ['legal-info'],
    queryFn: () => api.get<PublicLegalInfo>('/legal'),
    staleTime: 10 * 60_000,
  });
  return data?.urls?.storefront ?? 'https://blackstore.pymail.cm';
}
