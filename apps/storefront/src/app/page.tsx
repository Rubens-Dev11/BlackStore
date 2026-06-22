import { ProductsCatalog } from '@/components/products-catalog';

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold tracking-tight">Catalogue produits</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Base frontend connectée à l&apos;API NestJS (GET /products).
        </p>
      </section>
      <ProductsCatalog />
    </div>
  );
}
