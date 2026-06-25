import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '@/stores/use-auth-store';
import { api } from '@/lib/api';
import { formatFcfa } from '@/lib/format';

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  paidOrders: number;
  pendingReviews: number;
  conversionRate: number;
  revenueLast30Days: number;
  ordersLast30Days: number;
}

interface SalesDataPoint {
  date: string;
  revenue: number;
  ordersCount: number;
}

export function DashboardPage() {
  const { accessToken } = useAuthStore();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats', accessToken),
    enabled: !!accessToken,
  });

  const { data: salesChart, isLoading: chartLoading } = useQuery({
    queryKey: ['sales-chart'],
    queryFn: () => api.get<SalesDataPoint[]>('/dashboard/sales-chart', accessToken),
    enabled: !!accessToken,
  });

  if (statsLoading || chartLoading) {
    return <p className="text-sm text-muted-foreground">Chargement...</p>;
  }

  if (!stats || !salesChart) {
    return <p className="text-sm text-muted-foreground">Erreur lors du chargement des statistiques.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
          <p className="text-sm text-muted-foreground">Commandes totales</p>
          <p className="text-2xl font-bold">{stats.totalOrders}</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
          <p className="text-sm text-muted-foreground">Revenus totaux</p>
          <p className="text-2xl font-bold">{formatFcfa(stats.totalRevenue)}</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
          <p className="text-sm text-muted-foreground">Produits actifs</p>
          <p className="text-2xl font-bold">{stats.totalProducts}</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
          <p className="text-sm text-muted-foreground">Avis en attente</p>
          <p className="text-2xl font-bold">{stats.pendingReviews}</p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Évolution des ventes</h2>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesChart}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#f97316" name="Revenus" />
              <Line type="monotone" dataKey="ordersCount" stroke="#3b82f6" name="Commandes" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            stats.totalOrders - stats.paidOrders > 0
              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          Commandes en attente : {stats.totalOrders - stats.paidOrders}
        </span>
        <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          Taux de conversion : {stats.conversionRate}%
        </span>
      </div>
    </div>
  );
}
