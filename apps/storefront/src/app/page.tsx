import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="text-center space-y-4 py-12">
        <h2 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          Découvrez nos produits numériques
        </h2>
        <p className="text-lg text-muted-foreground max-w-[800px] mx-auto">
          Applications Android, logiciels de bureau et utilitaires. Achat sécurisé via CinetPay avec téléchargement immédiat.
        </p>
      </section>

      <section>
        <h3 className="text-2xl font-semibold tracking-tight mb-6">Produits à la une</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Skeleton placeholders */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-xl p-4 flex flex-col justify-between h-56 bg-card text-card-foreground">
              <div className="space-y-2">
                <div className="w-12 h-12 bg-muted rounded-md mb-4" />
                <h4 className="font-medium text-lg leading-none">Produit Demo {i}</h4>
                <p className="text-sm text-muted-foreground">Description courte du produit de démonstration avec aperçu.</p>
              </div>
              <div className="flex justify-between items-center mt-4">
                <span className="font-bold">5 000 FCFA</span>
                <Link href="#" className="text-sm font-medium text-primary hover:underline">
                  Voir plus
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
