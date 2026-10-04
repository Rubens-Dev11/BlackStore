import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface BoundaryProps {
  children: ReactNode;
  /** Change à chaque navigation : l'erreur d'une page ne bloque pas les autres. */
  resetKey: string;
  fullScreen?: boolean;
}

interface BoundaryState {
  error: Error | null;
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erreur d'affichage", error, info.componentStack);
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={`flex flex-col items-center justify-center px-4 text-center ${this.props.fullScreen ? 'min-h-screen' : 'min-h-[60vh]'}`} role="alert">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </div>
        <h1 className="mt-5 text-2xl font-bold">Cette page a rencontré un problème</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Rechargez la page pour réessayer. Vos données enregistrées ne sont pas perdues. Si le problème revient, notez ce que vous faisiez au moment de l&apos;erreur.
        </p>
        <p className="mt-2 max-w-md break-words text-xs text-muted-foreground">Détail technique : {this.state.error.message || 'erreur inconnue'}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Recharger la page
          </button>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-md border px-6 py-2 text-sm font-medium hover:bg-muted"
          >
            Réessayer sans recharger
          </button>
        </div>
      </div>
    );
  }
}

/**
 * Évite l'écran blanc : si une page plante à l'affichage, on montre un message
 * et un bouton pour recharger, en gardant le menu autour.
 */
export function PageErrorBoundary({ children, fullScreen }: { children: ReactNode; fullScreen?: boolean }) {
  const location = useLocation();
  return (
    <Boundary resetKey={location.pathname} fullScreen={fullScreen}>
      {children}
    </Boundary>
  );
}
