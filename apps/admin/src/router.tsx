import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '@/layouts/admin-layout';
import { DashboardPage } from '@/pages/dashboard-page';
import { LoginPage } from '@/pages/login-page';
import { ProductsPage } from '@/pages/products-page';
import { ProductFormPage } from '@/pages/product-form-page';
import { CategoriesPage } from '@/pages/categories-page';
import { OrdersPage } from '@/pages/orders-page';
import { ReviewsPage } from '@/pages/reviews-page';
import { AnalyticsPage } from '@/pages/analytics-page';

import { NotFoundPage } from '@/pages/not-found-page';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/produits" element={<ProductsPage />} />
        <Route path="/produits/nouveau" element={<ProductFormPage />} />
        <Route path="/produits/:id/modifier" element={<ProductFormPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/commandes" element={<OrdersPage />} />
        <Route path="/avis" element={<ReviewsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
