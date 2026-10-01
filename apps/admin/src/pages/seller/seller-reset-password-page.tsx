import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sellerAuthRequest, SellerApiError } from '@/lib/seller-api';
import { sellerResetPasswordSchema } from '@/lib/validations';
import { AuthButton, AuthField, AuthNotice, SellerAuthCard } from '@/layouts/seller-auth-card';

export function SellerResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = sellerResetPasswordSchema.safeParse(form);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      await sellerAuthRequest('reset-password', { token, newPassword: result.data.newPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof SellerApiError ? err.message : 'Erreur. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <SellerAuthCard title="Lien incomplet">
        <div className="space-y-4">
          <AuthNotice tone="error">Ce lien est incomplet. Utilisez le bouton reçu par e-mail, ou demandez un nouveau lien.</AuthNotice>
          <Link to="/vendeur/mot-de-passe-oublie" className="block text-center text-sm text-orange-400 hover:underline">
            Demander un nouveau lien
          </Link>
        </div>
      </SellerAuthCard>
    );
  }

  if (done) {
    return (
      <SellerAuthCard title="Mot de passe modifié">
        <div className="space-y-4">
          <AuthNotice tone="success">Votre nouveau mot de passe est enregistré. Vous pouvez vous connecter.</AuthNotice>
          <Link
            to="/vendeur/connexion"
            className="block w-full py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white text-center font-semibold rounded-md"
          >
            Se connecter
          </Link>
        </div>
      </SellerAuthCard>
    );
  }

  return (
    <SellerAuthCard
      title="Nouveau mot de passe"
      footer={
        <Link to="/vendeur/mot-de-passe-oublie" className="text-orange-400 hover:underline">Demander un nouveau lien</Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthField
          label="Nouveau mot de passe (8 caractères, une lettre et un chiffre)"
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
        />
        <AuthField
          label="Confirmer le mot de passe"
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
        />
        {error && <AuthNotice tone="error">{error}</AuthNotice>}
        <AuthButton type="submit" loading={loading}>
          {loading ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
        </AuthButton>
      </form>
    </SellerAuthCard>
  );
}
