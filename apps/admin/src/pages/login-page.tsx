export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-xl font-bold">BlackStore Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Page de connexion — implémentation Phase 2.
        </p>
        <form className="mt-6 space-y-4" onSubmit={(event) => event.preventDefault()}>
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="admin@blackstore.cm"
              disabled
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              disabled
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground opacity-50"
            disabled
          >
            Se connecter (bientôt)
          </button>
        </form>
      </div>
    </div>
  );
}
