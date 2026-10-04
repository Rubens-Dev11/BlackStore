import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import type { MarketplaceSettings } from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage, BUTTON_CLASS, INPUT_CLASS } from '@/components/form-field';
import { useStorefrontUrl, type LegalSettings } from '@/lib/legal';

/** Commission, délai de sécurité et retrait minimum de la marketplace. */
export function MarketplaceSettingsPage() {
  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['marketplace-settings'],
    queryFn: () => api.get<MarketplaceSettings>('/admin/wallet/settings', accessToken),
  });
  const [form, setForm] = useState({ commissionRate: '', holdDays: '', minWithdrawal: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({ commissionRate: String(settings.commissionRate), holdDays: String(settings.holdDays), minWithdrawal: String(settings.minWithdrawal) });
    }
  }, [settings]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      commissionRate: Number(form.commissionRate.replace(',', '.')),
      holdDays: Number(form.holdDays),
      minWithdrawal: Number(form.minWithdrawal.replace(/\s/g, '')),
    };
    if (Object.values(payload).some((v) => !Number.isFinite(v))) return notify.error('Remplissez les trois réglages avec des nombres');
    setSaving(true);
    try {
      const saved = await api.put<MarketplaceSettings>('/admin/wallet/settings', payload, accessToken);
      queryClient.setQueryData(['marketplace-settings'], saved);
      notify.success('Réglages enregistrés : ils s’appliquent aux prochaines ventes');
    } catch (err) {
      notify.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Chargement...</p>;

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Réglages de la marketplace</h1>
        <p className="text-sm text-muted-foreground">
          Un changement vaut pour les ventes à venir : chaque vente garde la commission appliquée au moment du paiement.
        </p>
      </div>
      <form onSubmit={save} className="space-y-4 rounded-lg border bg-background p-4" noValidate>
        <div>
          <label htmlFor="commissionRate" className="mb-1 block text-sm font-medium">Commission BlackStore (%)</label>
          <input id="commissionRate" inputMode="decimal" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} className={INPUT_CLASS} />
          <p className="mt-1 text-xs text-muted-foreground">Prélevée sur chaque vente payée, de 0 à 50 %.</p>
        </div>
        <div>
          <label htmlFor="holdDays" className="mb-1 block text-sm font-medium">Délai de sécurité (jours)</label>
          <input id="holdDays" inputMode="numeric" value={form.holdDays} onChange={(e) => setForm({ ...form, holdDays: e.target.value })} className={INPUT_CLASS} />
          <p className="mt-1 text-xs text-muted-foreground">Temps entre le paiement et le moment où le vendeur peut retirer l'argent (pour couvrir les remboursements).</p>
        </div>
        <div>
          <label htmlFor="minWithdrawal" className="mb-1 block text-sm font-medium">Retrait minimum (FCFA)</label>
          <input id="minWithdrawal" inputMode="numeric" value={form.minWithdrawal} onChange={(e) => setForm({ ...form, minWithdrawal: e.target.value })} className={INPUT_CLASS} />
        </div>
        <button type="submit" disabled={saving} className={BUTTON_CLASS}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>
      <LegalInfoForm />
    </div>
  );
}

const LEGAL_FIELDS: { key: keyof Omit<LegalSettings, 'updatedAt'>; label: string; placeholder: string; hint?: string }[] = [
  { key: 'legalName', label: "Nom de l'éditeur", placeholder: 'Votre nom complet, ou le nom de votre société', hint: 'Personne ou société qui exploite BlackStore.' },
  { key: 'legalForm', label: 'Statut', placeholder: 'Ex. : entreprise individuelle, SARL…' },
  { key: 'legalAddress', label: 'Adresse', placeholder: 'Quartier, ville' },
  { key: 'rccm', label: 'Numéro RCCM', placeholder: 'À remplir dès l’immatriculation' },
  { key: 'niu', label: 'NIU (impôts)', placeholder: 'Numéro d’identifiant unique' },
  { key: 'contactEmail', label: 'E-mail de contact', placeholder: 'contact@…', hint: 'Affiché aux clients ; vos réponses aux messages partent avec cette adresse en « répondre à ».' },
  { key: 'contactPhone', label: 'Téléphone ou WhatsApp', placeholder: '6 99 00 00 00' },
  { key: 'hostingInfo', label: 'Hébergeur', placeholder: 'Nom et adresse de la société qui loue le serveur' },
];

type LegalForm = Record<(typeof LEGAL_FIELDS)[number]['key'], string>;

/** Identité de l'éditeur et contact, affichés dans les mentions légales, les conditions et la page Contact. */
function LegalInfoForm() {
  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();
  const storefront = useStorefrontUrl();
  const { data: legal } = useQuery({
    queryKey: ['admin-legal-info'],
    queryFn: () => api.get<LegalSettings>('/admin/legal-info', accessToken),
  });
  const [form, setForm] = useState<LegalForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (legal) {
      setForm(Object.fromEntries(LEGAL_FIELDS.map((f) => [f.key, legal[f.key] ?? ''])) as LegalForm);
    }
  }, [legal]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const saved = await api.put<LegalSettings>('/admin/legal-info', form, accessToken);
      queryClient.setQueryData(['admin-legal-info'], saved);
      notify.success('Informations enregistrées : elles apparaissent tout de suite sur le site');
    } catch (err) {
      notify.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!form) return null;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Informations légales et contact</h2>
        <p className="text-sm text-muted-foreground">
          Affichées dans les{' '}
          <a href={`${storefront}/mentions-legales`} target="_blank" rel="noreferrer" className="text-primary underline">
            mentions légales
          </a>
          , les conditions et la page Contact du site. Laissez vide ce que vous n'avez pas encore (le RCCM par exemple).
        </p>
      </div>
      <form onSubmit={save} className="space-y-4 rounded-lg border bg-background p-4" noValidate>
        {LEGAL_FIELDS.map((field) => (
          <div key={field.key}>
            <label htmlFor={field.key} className="mb-1 block text-sm font-medium">{field.label}</label>
            <input
              id={field.key}
              value={form[field.key]}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
              placeholder={field.placeholder}
              className={INPUT_CLASS}
            />
            {field.hint && <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>}
          </div>
        ))}
        <button type="submit" disabled={saving} className={BUTTON_CLASS}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}
