import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '@/layouts/admin-layout';
import { DashboardPage } from '@/pages/dashboard-page';
import { LoginPage } from '@/pages/login-page';
import { PlaceholderPage } from '@/pages/placeholder-page';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/produits" element={<PlaceholderPage title="Produits" />} />
        <Route path="/categories" element={<PlaceholderPage title="Catégories" />} />
        <Route path="/commandes" element={<PlaceholderPage title="Commandes" />} />
        <Route path="/avis" element={<PlaceholderPage title="Avis" />} />
        <Route path="/analytics" element={<PlaceholderPage title="Analytics" />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
