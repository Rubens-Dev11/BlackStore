import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useAuthStore } from '@/stores/use-auth-store';
import { api } from '@/lib/api';

interface AnalyticsData {
  trafficSources: { utmSource: string | null; count: number }[];
  topProductsByViews: {
    productId: string | null;
    productName: string | null;
    viewCount: number;
  }[];
  conversionFunnel: {
    productViews: number;
    ordersCreated: number;
    ordersPaid: number;
  };
}

export function AnalyticsPage() {
  const { accessToken } = useAuthStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => api.get<AnalyticsData>('/dashboard/analytics', accessToken),
    enabled: !!accessToken,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Chargement...</p>;
  }

  if (isError || !data) {
    return <p className="text-sm text-muted-foreground">Erreur lors du chargement des analytics.</p>;
  }

  const trafficData = data.trafficSources.map((source) => ({
    name: source.utmSource ?? 'Direct',
    count: source.count,
  }));

  const productsData = data.topProductsByViews.map((product) => ({
    name: product.productName ?? 'Produit inconnu',
    views: product.viewCount,
  }));

  const { productViews, ordersCreated, ordersPaid } = data.conversionFunnel;
  const viewToOrderRate =
    productViews === 0 ? 0 : Math.round((ordersCreated / productViews) * 10000) / 100;
  const orderToPaidRate =
    ordersCreated === 0 ? 0 : Math.round((ordersPaid / ordersCreated) * 10000) / 100;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Vues produits</p>
          <p className="text-2xl font-bold">{productViews}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Commandes créées</p>
          <p className="text-2xl font-bold">{ordersCreated}</p>
          <p className="text-xs text-muted-foreground">Taux vue → commande : {viewToOrderRate}%</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Commandes payées</p>
          <p className="text-2xl font-bold">{ordersPaid}</p>
          <p className="text-xs text-muted-foreground">Taux commande → paiement : {orderToPaidRate}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-lg font-medium">Sources de trafic (UTM)</h2>
          {trafficData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnée UTM disponible.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trafficData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#f97316" name="Visites" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-lg font-medium">Top produits par vues</h2>
          {productsData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune vue produit enregistrée.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={productsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="views" fill="#3b82f6" name="Vues" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>
    </div>
  );
}
