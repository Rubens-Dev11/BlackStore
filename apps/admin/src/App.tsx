
function App() {
  return (
    <div className="flex h-screen w-full flex-col md:flex-row bg-muted/40">
      {/* Sidebar Placeholder */}
      <aside className="w-full md:w-64 bg-background border-r flex flex-col p-4 shrink-0">
        <div className="font-bold text-xl mb-8 tracking-tight">BlackStore Admin</div>
        <nav className="flex flex-col gap-2">
          <a href="#" className="flex item-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium">
            Tableau de bord
          </a>
          <a href="#" className="flex item-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            Produits
          </a>
          <a href="#" className="flex item-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            Catégories
          </a>
          <a href="#" className="flex item-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            Commandes
          </a>
          <a href="#" className="flex item-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            Avis Clients
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">admin@blackstore.cm</span>
            <button className="text-sm font-medium text-primary hover:underline">Déconnexion</button>
          </div>
        </header>

        {/* Dashboard Placeholder */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <div className="font-semibold text-sm mb-2 text-muted-foreground">Revenus du mois</div>
            <div className="text-2xl font-bold">1 250 000 FCFA</div>
          </div>
          <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <div className="font-semibold text-sm mb-2 text-muted-foreground">Commandes</div>
            <div className="text-2xl font-bold">+24%</div>
          </div>
          <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <div className="font-semibold text-sm mb-2 text-muted-foreground">Nouveaux clients</div>
            <div className="text-2xl font-bold">145</div>
          </div>
          <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <div className="font-semibold text-sm mb-2 text-muted-foreground">Taux de conversion</div>
            <div className="text-2xl font-bold">4.2%</div>
          </div>
        </div>

        {/* Charts/Tables Placeholder */}
        <div className="mt-8 grid gap-4 grid-cols-1 lg:grid-cols-2">
          <div className="rounded-xl border bg-card shadow h-80 flex items-center justify-center text-muted-foreground">
            [Graphique Recharts - Évolution des ventes]
          </div>
          <div className="rounded-xl border bg-card shadow h-80 flex items-center justify-center text-muted-foreground">
            [Tableau - Dernières commandes]
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
