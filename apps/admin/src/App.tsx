import { AppProviders } from '@/providers/app-providers';
import { AppRouter } from '@/router';
import { Toaster } from 'sonner';

function App() {
  return (
    <AppProviders>
      <AppRouter />
      <Toaster position="top-right" richColors duration={3000} />
    </AppProviders>
  );
}

export default App;
