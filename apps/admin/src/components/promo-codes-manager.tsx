import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';
import { notify } from '@/lib/toast';
import { TONE_CLASSES } from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage, BUTTON_CLASS, INPUT_CLASS } from '@/components/form-field';

export interface PromoCodeView {
  id: string;
  code: string;
  discountType: 'percent' | 'amount';
  value: number;
  label: string;
  maxUses: number | null;
  oncePerCustomer: boolean;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  uses: number;
  discountGiven: number;
  expired: boolean;
}

interface PromoCodesResponse {
  owner: string | null;
  hasStore: boolean;
  codes: PromoCodeView[];
}

const EMPTY_FORM = { code: '', discountType: 'percent' as 'percent' | 'amount', value: '', maxUses: '', expiresOn: '', oncePerCustomer: false };

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Douala' });

/** Date du jour au Cameroun (AAAA-MM-JJ), minimum du champ « date de fin ». */
const todayInDouala = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' });

function statusOf(code: PromoCodeView): { label: string; tone: keyof typeof TONE_CLASSES } {
  if (!code.isActive) return { label: 'Désactivé', tone: 'gray' };
  if (code.expired) return { label: 'Expiré', tone: 'gray' };
  if (code.maxUses !== null && code.uses >= code.maxUses) return { label: 'Épuisé', tone: 'yellow' };
  return { label: 'Actif', tone: 'green' };
}

/**
 * Création et suivi des codes promo, partagés par l'espace vendeur (codes de sa boutique) et l'admin
 * (codes de BlackStore).
 */
export function PromoCodesManager({ basePath, intro }: { basePath: '/seller/promo-codes' | '/admin/promo-codes'; intro: ReactNode }) {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const queryKey = ['promo-codes', basePath];
  const [form, setForm] = useState(EMPTY_FORM);

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => api.get<PromoCodesResponse>(basePath, accessToken),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const create = useMutation({
    mutationFn: () =>
      api.post<PromoCodeView>(
        basePath,
        {
          code: form.code.trim(),
          discountType: form.discountType,
          value: Number(form.value),
          maxUses: form.maxUses ? Number(form.maxUses) : undefined,
          // Valable jusqu'à la fin du jour choisi, heure du Cameroun.
          expiresAt: form.expiresOn ? `${form.expiresOn}T23:59:59+01:00` : undefined,
          oncePerCustomer: form.oncePerCustomer,
        },
        accessToken,
      ),
    onSuccess: (created) => {
      refresh();
      setForm(EMPTY_FORM);
      notify.success(`Code ${created.code} créé : il est utilisable tout de suite.`);
    },
    onError: (err) => notify.error(apiErrorMessage(err)),
  });

  const toggle = useMutation({
    mutationFn: (code: PromoCodeView) => api.patch<PromoCodeView>(`${basePath}/${code.id}`, { isActive: !code.isActive }, accessToken),
    onSuccess: (updated) => {
      refresh();
      notify.success(updated.isActive ? `Code ${updated.code} réactivé.` : `Code ${updated.code} désactivé : il n'est plus accepté.`);
    },
    onError: (err) => notify.error(apiErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (code: PromoCodeView) => api.delete(`${basePath}/${code.id}`, accessToken),
    onSuccess: () => {
      refresh();
      notify.success('Code promo supprimé.');
    },
    onError: (err) => notify.error(apiErrorMessage(err)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(form.value);
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(form.code.trim())) {
      notify.error('Le code compte 3 à 30 caractères : lettres sans accent, chiffres, tiret ou souligné.');
      return;
    }
    if (!Number.isInteger(value) || value < 1) {
      notify.error('Indiquez la réduction (nombre entier).');
      return;
    }
    if (form.discountType === 'percent' && value > 100) {
      notify.error('Une réduction en pourcentage va de 1 à 100 %.');
      return;
    }
    if (form.discountType === 'amount' && value % 5 !== 0) {
      notify.error('Une réduction en montant est un multiple de 5 FCFA (5, 10, 500…).');
      return;
    }
    create.mutate();
  };

  const codes = data?.codes ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Codes promo</h1>
        <div className="space-y-1 text-sm text-muted-foreground">{intro}</div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
      {isError && <p className="text-sm text-red-600">Impossible de charger les codes promo. Rechargez la page.</p>}

      {data && !data.hasStore && (
        <p className="rounded-lg border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
          Créez d'abord <Link to="/vendeur/boutique" className="font-medium text-primary underline">votre boutique</Link> : les codes promo
          s'appliquent à ses produits.
        </p>
      )}

      {data?.hasStore && (
        <form onSubmit={submit} className="space-y-4 rounded-lg border bg-background p-4">
          <h2 className="text-sm font-semibold">Nouveau code</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="promo-code" className="mb-1 block text-sm font-medium">Code (que vos clients taperont)</label>
              <input
                id="promo-code"
                required
                maxLength={30}
                placeholder="NOEL10"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })}
                className={`${INPUT_CLASS} font-mono uppercase`}
              />
            </div>
            <div>
              <label htmlFor="promo-value" className="mb-1 block text-sm font-medium">Réduction</label>
              <div className="flex gap-2">
                <input
                  id="promo-value"
                  required
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={form.discountType === 'percent' ? 100 : undefined}
                  step={form.discountType === 'percent' ? 1 : 5}
                  placeholder={form.discountType === 'percent' ? '10' : '500'}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className={`${INPUT_CLASS} min-w-0`}
                />
                <select
                  aria-label="Type de réduction"
                  value={form.discountType}
                  onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percent' | 'amount' })}
                  className={`${INPUT_CLASS} w-auto`}
                >
                  <option value="percent">%</option>
                  <option value="amount">FCFA</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {form.discountType === 'percent'
                  ? 'Sur chaque produit concerné du panier.'
                  : 'Déduit une fois par commande, sur les produits concernés.'}
              </p>
            </div>
            <div>
              <label htmlFor="promo-max" className="mb-1 block text-sm font-medium">Nombre d'utilisations (facultatif)</label>
              <input
                id="promo-max"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="Illimité"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="promo-end" className="mb-1 block text-sm font-medium">Valable jusqu'au (facultatif)</label>
              <input
                id="promo-end"
                type="date"
                min={todayInDouala()}
                value={form.expiresOn}
                onChange={(e) => setForm({ ...form, expiresOn: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.oncePerCustomer}
              onChange={(e) => setForm({ ...form, oncePerCustomer: e.target.checked })}
              className="h-4 w-4"
            />
            Une seule utilisation par client (adresse e-mail)
          </label>
          <button type="submit" disabled={create.isPending} className={BUTTON_CLASS}>
            {create.isPending ? 'Création...' : 'Créer le code'}
          </button>
        </form>
      )}

      {data?.hasStore && codes.length === 0 && (
        <p className="rounded-lg border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
          Aucun code promo pour l'instant.
        </p>
      )}

      <ul className="space-y-3">
        {codes.map((code) => {
          const status = statusOf(code);
          return (
            <li key={code.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-background p-4">
              <div className="min-w-0 space-y-1 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base font-semibold">{code.code}</span>
                  <span className="font-medium">{code.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[status.tone]}`}>{status.label}</span>
                </p>
                <p className="text-muted-foreground">
                  Utilisé {code.uses} fois{code.maxUses !== null && <> sur {code.maxUses}</>}
                  {code.discountGiven > 0 && <> · {formatFcfa(code.discountGiven)} de réductions accordées</>}
                </p>
                <p className="text-muted-foreground">
                  {code.expiresAt ? `${code.expired ? 'A expiré le' : "Jusqu'au"} ${formatDay(code.expiresAt)}` : 'Sans date de fin'}
                  {code.oncePerCustomer && ' · une fois par client'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate(code)}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                >
                  {code.isActive ? 'Désactiver' : 'Réactiver'}
                </button>
                {code.uses === 0 && (
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`Supprimer le code ${code.code} ?`)) remove.mutate(code);
                    }}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
