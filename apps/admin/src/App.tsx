import { AppProviders } from '@/providers/app-providers';
import { AppRouter } from '@/router';
import { PageErrorBoundary } from '@/components/page-error-boundary';
import { Toaster } from 'sonner';

function App() {
  return (
    <AppProviders>
      {/* Dernier filet si une mise en page elle-même plante (les pages ont le leur). */}
      <PageErrorBoundary fullScreen>
        <AppRouter />
      </PageErrorBoundary>
      <Toaster position="top-right" richColors duration={3000} />
    </AppProviders>
  );
}

export default App;
