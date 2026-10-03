import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import type { MarketplaceSettings } from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage, BUTTON_CLASS, INPUT_CLASS } from '@/components/form-field';

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
    </div>
  );
}
