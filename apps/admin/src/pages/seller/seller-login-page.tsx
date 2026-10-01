import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/use-auth-store';
import { sellerAuthRequest, SellerApiError, type SellerTokens } from '@/lib/seller-api';
import { sellerLoginSchema } from '@/lib/validations';
import { AuthButton, AuthField, AuthNotice, SellerAuthCard } from '@/layouts/seller-auth-card';

export function SellerLoginPage() {
  const navigate = useNavigate();
  const { accessToken, role, setTokens } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<SellerApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  if (accessToken && role === 'seller') return <Navigate to="/vendeur" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResent(false);

    const result = sellerLoginSchema.safeParse(form);
    if (!result.success) {
      setError(new SellerApiError(400, result.error.issues[0].message));
      return;
    }

    setLoading(true);
    try {
      const tokens = await sellerAuthRequest<SellerTokens>('login', result.data);
      setTokens(tokens.accessToken, tokens.refreshToken, 'seller');
      navigate('/vendeur', { replace: true });
    } catch (err) {
      setError(err instanceof SellerApiError ? err : new SellerApiError(0, 'Erreur. Réessayez.'));
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    try {
      await sellerAuthRequest('resend-verification', { email: form.email.trim() });
      setResent(true);
    } catch (err) {
      setError(err instanceof SellerApiError ? err : new SellerApiError(0, 'Erreur. Réessayez.'));
    }
  };

  return (
    <SellerAuthCard
      title="Connexion vendeur"
      footer={
        <>
          <p>
            <Link to="/vendeur/mot-de-passe-oublie" className="text-orange-400 hover:underline">Mot de passe oublié ?</Link>
          </p>
          <p>
            Pas encore de compte ?{' '}
            <Link to="/vendeur/inscription" className="text-orange-400 hover:underline">Devenir vendeur</Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthField label="E-mail" id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <AuthField label="Mot de passe" id="password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && (
          <AuthNotice tone="error">
            {error.message}
            {error.code === 'EMAIL_NOT_VERIFIED' && !resent && (
              <button type="button" onClick={resendVerification} className="mt-2 block text-orange-300 hover:underline">
                Renvoyer le lien de confirmation
              </button>
            )}
            {resent && <span className="mt-2 block">Un nouveau lien vient d'être envoyé.</span>}
          </AuthNotice>
        )}
        <AuthButton type="submit" loading={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </AuthButton>
      </form>
    </SellerAuthCard>
  );
}
