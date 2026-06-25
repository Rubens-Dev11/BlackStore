import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/use-auth-store';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface OrderItem {
  id: string;
  productId: string;
  priceAtPurchase: number;
  product: { name: string; slug: string };
}

interface Order {
  id: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod: string | null;
  paymentReference: string | null;
  createdAt: string;
  paidAt: string | null;
  items: OrderItem[];
}

interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_LABELS: Record<Order['status'], { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' },
  paid: { label: 'Payée', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' },
  failed: { label: 'Échouée', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' },
  refunded: { label: 'Remboursée', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200' },
};

// ─────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────

export function OrdersPage() {
  const { accessToken } = useAuthStore();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get<OrdersResponse>('/orders', accessToken),
    enabled: !!accessToken,
  });

  async function exportCsv() {
    try {
      const blob = await api.getBlob('/dashboard/export-orders', accessToken);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'commandes.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erreur lors de l\'export CSV');
    }
  }

  const orders = data?.data ?? [];
  const filtered =
    filterStatus === 'all' ? orders : orders.filter((o) => o.status === filterStatus);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Commandes</h1>
        <button
          onClick={exportCsv}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
        >
          ⬇ Exporter CSV
        </button>
      </div>

      {/* Filtres statut */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {(['all', 'pending', 'paid', 'failed', 'refunded'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterStatus === s
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-muted'
            }`}
          >
            {s === 'all'
              ? `Toutes (${orders.length})`
              : `${STATUS_LABELS[s].label} (${orders.filter((o) => o.status === s).length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Aucune commande trouvée.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full rounded-lg border bg-card text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">N° Commande</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">Client</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">Montant</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">Statut</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">Date</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((order) => {
                const status = STATUS_LABELS[order.status];
                return (
                  <tr key={order.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4 font-mono text-xs">{order.orderNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{order.buyerName}</div>
                      <div className="text-xs text-muted-foreground">{order.buyerEmail}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-orange-600">
                      {formatFcfa(order.totalAmount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="rounded px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                      >
                        Détail
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Panel de détail commande */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => e.target === e.currentTarget && setSelectedOrder(null)}
        >
          <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Commande {selectedOrder.orderNumber}</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded p-1 hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedOrder.buyerName}</p>
                  <p className="text-muted-foreground">{selectedOrder.buyerEmail}</p>
                  {selectedOrder.buyerPhone && (
                    <p className="text-muted-foreground">{selectedOrder.buyerPhone}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paiement</p>
                  <p className="font-medium">{formatFcfa(selectedOrder.totalAmount)}</p>
                  <p className="text-muted-foreground">{selectedOrder.paymentMethod ?? '—'}</p>
                  {selectedOrder.paymentReference && (
                    <p className="font-mono text-xs text-muted-foreground">
                      {selectedOrder.paymentReference}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs text-muted-foreground">Produits commandés</p>
                <div className="divide-y rounded-md border">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2">
                      <span>{item.product.name}</span>
                      <span className="text-orange-600 font-medium">
                        {formatFcfa(item.priceAtPurchase)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.paidAt && (
                <p className="text-xs text-muted-foreground">
                  Payée le{' '}
                  {new Date(selectedOrder.paidAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
