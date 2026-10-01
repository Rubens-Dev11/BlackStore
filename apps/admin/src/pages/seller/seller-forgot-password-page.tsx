import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sellerAuthRequest, SellerApiError } from '@/lib/seller-api';
import { sellerEmailSchema } from '@/lib/validations';
import { AuthButton, AuthField, AuthNotice, SellerAuthCard } from '@/layouts/seller-auth-card';

export function SellerForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = sellerEmailSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      await sellerAuthRequest('forgot-password', result.data);
      setSent(true);
    } catch (err) {
      setError(err instanceof SellerApiError ? err.message : 'Erreur. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SellerAuthCard
      title="Mot de passe oublié"
      subtitle={sent ? undefined : 'Indiquez votre e-mail : nous vous enverrons un lien pour choisir un nouveau mot de passe.'}
      footer={<Link to="/vendeur/connexion" className="text-orange-400 hover:underline">Retour à la connexion</Link>}
    >
      {sent ? (
        <AuthNotice tone="success">
          Si un compte existe pour cette adresse, un lien vient d'être envoyé. Il est valable 1 heure.
        </AuthNotice>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <AuthField label="E-mail" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <AuthNotice tone="error">{error}</AuthNotice>}
          <AuthButton type="submit" loading={loading}>
            {loading ? 'Envoi...' : 'Recevoir le lien'}
          </AuthButton>
        </form>
      )}
    </SellerAuthCard>
  );
}
