import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import { IDENTITY_STATUS_LABELS, TONE_CLASSES, type SellerProfile, type SellerStatus } from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';

const STATUS_LABELS: Record<SellerStatus, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' },
  approved: { label: 'Validé', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' },
  suspended: { label: 'Suspendu', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' },
};

const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Validés' },
  { value: 'suspended', label: 'Suspendus' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

const ACTION_CLASS = {
  approve: 'text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950',
  suspend: 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function SellersPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');

  const { data: sellers = [], isLoading, isError } = useQuery({
    queryKey: ['admin-sellers'],
    queryFn: () => api.get<SellerProfile[]>('/admin/sellers', accessToken),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SellerStatus }) =>
      api.patch<SellerProfile>(`/admin/sellers/${id}/status`, { status }, accessToken),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-sellers'] });
      notify.success(`${updated.firstName} ${updated.lastName} : ${STATUS_LABELS[updated.status].label.toLowerCase()}. Un e-mail l'a prévenu.`);
    },
    onError: (err: any) => notify.error(err?.message || 'Erreur serveur. Réessayez.'),
  });

  const changeStatus = (seller: SellerProfile, status: SellerStatus) => {
    if (
      status === 'suspended' &&
      !window.confirm(`Suspendre ${seller.firstName} ${seller.lastName} ? Sa session sera fermée immédiatement.`)
    ) {
      return;
    }
    statusMutation.mutate({ id: seller.id, status });
  };

  const count = (value: Filter) => (value === 'all' ? sellers.length : sellers.filter((s) => s.status === value).length);
  const filtered = filter === 'all' ? sellers : sellers.filter((s) => s.status === filter);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Vendeurs</h1>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.value ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'
            }`}
          >
            {f.label} ({count(f.value)})
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : isError ? (
        <p className="text-sm text-red-600">Impossible de charger les vendeurs. Rechargez la page.</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Aucun vendeur pour le moment.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full rounded-lg border bg-card text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">Vendeur</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">Boutique</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">Téléphone</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">E-mail confirmé</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">Statut</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">Identité</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">Inscrit le</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((seller) => {
                const status = STATUS_LABELS[seller.status];
                const busy = statusMutation.isPending && statusMutation.variables?.id === seller.id;
                return (
                  <tr key={seller.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4">
                      <div className="font-medium">{seller.firstName} {seller.lastName}</div>
                      <div className="text-xs text-muted-foreground">{seller.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      {seller.store ? (
                        <>
                          <div className="font-medium">{seller.store.name}</div>
                          <div className="text-xs text-muted-foreground">/boutique/{seller.store.slug}</div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pas encore créée</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">{seller.phone}</td>
                    <td className="py-3 px-4 text-xs">{seller.emailVerifiedAt ? 'Oui' : 'Non'}</td>
                    <td className="py-3 px-4">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        const identity = IDENTITY_STATUS_LABELS[seller.identityChecks[0]?.status ?? 'none'];
                        return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[identity.tone]}`}>{identity.label}</span>;
                      })()}
                    </td>
                    <td className="whitespace-nowrap py-3 px-4 text-xs text-muted-foreground">{formatDate(seller.createdAt)}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {seller.status !== 'approved' && (
                          <button
                            disabled={busy}
                            onClick={() => changeStatus(seller, 'approved')}
                            className={`whitespace-nowrap rounded px-3 py-1 text-xs font-medium disabled:opacity-50 ${ACTION_CLASS.approve}`}
                          >
                            {seller.status === 'suspended' ? 'Réactiver' : 'Valider'}
                          </button>
                        )}
                        {seller.status !== 'suspended' && (
                          <button
                            disabled={busy}
                            onClick={() => changeStatus(seller, 'suspended')}
                            className={`whitespace-nowrap rounded px-3 py-1 text-xs font-medium disabled:opacity-50 ${ACTION_CLASS.suspend}`}
                          >
                            Suspendre
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
