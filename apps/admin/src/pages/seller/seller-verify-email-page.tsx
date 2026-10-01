import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sellerAuthRequest, SellerApiError } from '@/lib/seller-api';
import { sellerEmailSchema } from '@/lib/validations';
import { AuthButton, AuthField, AuthNotice, SellerAuthCard } from '@/layouts/seller-auth-card';

type State = 'checking' | 'confirmed' | 'invalid';

export function SellerVerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>(token ? 'checking' : 'invalid');
  const [email, setEmail] = useState('');
  const [resendMessage, setResendMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  // Le lien est à usage unique : un second envoi (double rendu en développement) le ferait échouer.
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    sellerAuthRequest('verify-email', { token })
      .then(() => setState('confirmed'))
      .catch(() => setState('invalid'));
  }, [token]);

  const resend = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = sellerEmailSchema.safeParse({ email });
    if (!result.success) {
      setResendMessage({ tone: 'error', text: result.error.issues[0].message });
      return;
    }
    try {
      await sellerAuthRequest('resend-verification', result.data);
      setResendMessage({ tone: 'success', text: 'Si ce compte existe et n’est pas encore confirmé, un nouveau lien vient d’être envoyé.' });
    } catch (err) {
      setResendMessage({ tone: 'error', text: err instanceof SellerApiError ? err.message : 'Erreur. Réessayez.' });
    }
  };

  if (state === 'checking') {
    return (
      <SellerAuthCard title="Confirmation en cours">
        <p className="text-center text-sm text-gray-400">Vérification de votre lien...</p>
      </SellerAuthCard>
    );
  }

  if (state === 'confirmed') {
    return (
      <SellerAuthCard title="Adresse confirmée">
        <div className="space-y-4">
          <AuthNotice tone="success">
            Votre adresse e-mail est confirmée. Vous pouvez vous connecter à votre espace vendeur.
          </AuthNotice>
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
      title="Lien invalide ou expiré"
      subtitle="Ce lien a déjà servi ou n'est plus valable. Demandez-en un nouveau :"
      footer={<Link to="/vendeur/connexion" className="text-orange-400 hover:underline">Aller à la connexion</Link>}
    >
      <form onSubmit={resend} className="space-y-4" noValidate>
        <AuthField label="Votre e-mail" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {resendMessage && <AuthNotice tone={resendMessage.tone}>{resendMessage.text}</AuthNotice>}
        <AuthButton type="submit">Recevoir un nouveau lien</AuthButton>
      </form>
    </SellerAuthCard>
  );
}
