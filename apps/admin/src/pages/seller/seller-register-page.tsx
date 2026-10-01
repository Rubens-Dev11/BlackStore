import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sellerAuthRequest, SellerApiError } from '@/lib/seller-api';
import { sellerRegisterSchema } from '@/lib/validations';
import { AuthButton, AuthField, AuthNotice, SellerAuthCard } from '@/layouts/seller-auth-card';

const EMPTY_FORM = { firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' };

export function SellerRegisterPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = sellerRegisterSchema.safeParse(form);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword: _confirm, ...payload } = result.data;
      await sellerAuthRequest('register', payload);
      setRegisteredEmail(result.data.email);
    } catch (err) {
      setError(err instanceof SellerApiError ? err.message : 'Erreur. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!registeredEmail) return;
    try {
      await sellerAuthRequest('resend-verification', { email: registeredEmail });
      setResent(true);
    } catch (err) {
      setError(err instanceof SellerApiError ? err.message : 'Erreur. Réessayez.');
    }
  };

  if (registeredEmail) {
    return (
      <SellerAuthCard
        title="Vérifiez votre boîte mail"
        footer={<Link to="/vendeur/connexion" className="text-orange-400 hover:underline">Aller à la connexion</Link>}
      >
        <div className="space-y-4">
          <AuthNotice tone="success">
            Votre compte est créé. Nous avons envoyé un lien de confirmation à <strong>{registeredEmail}</strong> : il
            est valable 48 heures. Pensez à regarder dans les courriers indésirables.
          </AuthNotice>
          {error && <AuthNotice tone="error">{error}</AuthNotice>}
          {resent ? (
            <p className="text-center text-sm text-gray-400">Un nouveau lien vient d'être envoyé.</p>
          ) : (
            <button onClick={resend} className="w-full text-sm text-orange-400 hover:underline">
              Je n'ai rien reçu : renvoyer le lien
            </button>
          )}
        </div>
      </SellerAuthCard>
    );
  }

  return (
    <SellerAuthCard
      title="Devenir vendeur"
      subtitle="Vendez vos produits numériques sur BlackStore. L'inscription est gratuite."
      footer={
        <p>
          Déjà un compte ?{' '}
          <Link to="/vendeur/connexion" className="text-orange-400 hover:underline">Se connecter</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <AuthField label="Prénom" id="firstName" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} />
          <AuthField label="Nom" id="lastName" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} />
        </div>
        <AuthField label="E-mail" id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
        <AuthField
          label="Téléphone (Mobile Money)"
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="6 99 00 00 00"
          value={form.phone}
          onChange={set('phone')}
        />
        <AuthField
          label="Mot de passe (8 caractères, une lettre et un chiffre)"
          id="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
        />
        <AuthField
          label="Confirmer le mot de passe"
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={set('confirmPassword')}
        />
        {error && <AuthNotice tone="error">{error}</AuthNotice>}
        <AuthButton type="submit" loading={loading}>
          {loading ? 'Création du compte...' : 'Créer mon compte vendeur'}
        </AuthButton>
      </form>
    </SellerAuthCard>
  );
}
