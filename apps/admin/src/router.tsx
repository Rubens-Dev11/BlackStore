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
import { AccountPage } from '@/pages/account-page';
import { SellersPage } from '@/pages/sellers-page';
import { SellerLayout } from '@/layouts/seller-layout';
import { SellerRegisterPage } from '@/pages/seller/seller-register-page';
import { SellerVerifyEmailPage } from '@/pages/seller/seller-verify-email-page';
import { SellerLoginPage } from '@/pages/seller/seller-login-page';
import { SellerForgotPasswordPage } from '@/pages/seller/seller-forgot-password-page';
import { SellerResetPasswordPage } from '@/pages/seller/seller-reset-password-page';
import { SellerDashboardPage } from '@/pages/seller/seller-dashboard-page';
import { SellerAccountPage } from '@/pages/seller/seller-account-page';
import { SellerStorePage } from '@/pages/seller/seller-store-page';
import { SellerProductsPage } from '@/pages/seller/seller-products-page';
import { SellerProductFormPage } from '@/pages/seller/seller-product-form-page';
import { ProductReviewPage } from '@/pages/product-review-page';
import { ReportsPage } from '@/pages/reports-page';
import { IdentityChecksPage } from '@/pages/identity-checks-page';
import { SellerIdentityPage } from '@/pages/seller/seller-identity-page';
import { SellerWalletPage } from '@/pages/seller/seller-wallet-page';
import { SellerReceiptPage } from '@/pages/seller/seller-receipt-page';
import { WithdrawalsPage } from '@/pages/withdrawals-page';
import { MarketplaceSettingsPage } from '@/pages/marketplace-settings-page';
import { MessagesPage } from '@/pages/messages-page';
import { BackupsPage } from '@/pages/backups-page';

import { NotFoundPage } from '@/pages/not-found-page';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/vendeur/inscription" element={<SellerRegisterPage />} />
      <Route path="/vendeur/connexion" element={<SellerLoginPage />} />
      <Route path="/vendeur/verifier-email" element={<SellerVerifyEmailPage />} />
      <Route path="/vendeur/mot-de-passe-oublie" element={<SellerForgotPasswordPage />} />
      <Route path="/vendeur/reinitialiser-mot-de-passe" element={<SellerResetPasswordPage />} />
      <Route element={<SellerLayout />}>
        <Route path="/vendeur" element={<SellerDashboardPage />} />
        <Route path="/vendeur/boutique" element={<SellerStorePage />} />
        <Route path="/vendeur/produits" element={<SellerProductsPage />} />
        <Route path="/vendeur/produits/nouveau" element={<SellerProductFormPage />} />
        <Route path="/vendeur/produits/:id" element={<SellerProductFormPage />} />
        <Route path="/vendeur/identite" element={<SellerIdentityPage />} />
        <Route path="/vendeur/gains" element={<SellerWalletPage />} />
        <Route path="/vendeur/gains/recus/:id" element={<SellerReceiptPage />} />
        <Route path="/vendeur/compte" element={<SellerAccountPage />} />
      </Route>
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
        <Route path="/vendeurs" element={<SellersPage />} />
        <Route path="/produits-a-valider" element={<ProductReviewPage />} />
        <Route path="/signalements" element={<ReportsPage />} />
        <Route path="/identites" element={<IdentityChecksPage />} />
        <Route path="/retraits" element={<WithdrawalsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/sauvegardes" element={<BackupsPage />} />
        <Route path="/reglages" element={<MarketplaceSettingsPage />} />
        <Route path="/compte" element={<AccountPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
