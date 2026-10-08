import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/use-auth-store';
import { notify } from '@/lib/toast';
import { loginSchema, passwordChangeCodeSchema } from '@/lib/validations';
import { NETWORK_ERROR, responseMessage } from '@/lib/errors';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

/** Réponse de /auth/login quand le mot de passe doit être remplacé : un code est parti par e-mail. */
interface PasswordChangeRequired {
  passwordChangeRequired: true;
  challenge: string;
  sentTo: string;
  expiresInMinutes: number;
}

const INPUT_CLASS =
  'w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-orange-500';
const BUTTON_CLASS =
  'w-full py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-md transition duration-200 disabled:opacity-70';

const EMPTY_CHANGE = { code: '', newPassword: '', confirmPassword: '' };

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('session') === 'expiree';
  const { accessToken, setTokens } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState<boolean>(false);
  const [pending, setPending] = useState<PasswordChangeRequired | null>(null);
  const [change, setChange] = useState(EMPTY_CHANGE);

  const openSession = (data: LoginResponse, message: string) => {
    setTokens(data.accessToken, data.refreshToken, 'admin');
    navigate('/dashboard');
    notify.success(message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = loginSchema.safeParse(form);
    if (!result.success) {
      notify.error(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      });

      if (response.ok) {
        const data: LoginResponse | PasswordChangeRequired = await response.json();
        if ('passwordChangeRequired' in data) {
          // Le mot de passe ne sert plus : on ne le garde pas en mémoire.
          setForm({ ...form, password: '' });
          setChange(EMPTY_CHANGE);
          setPending(data);
          return;
        }
        openSession(data, 'Connexion réussie');
      } else if (response.status === 401) {
        notify.error('Email ou mot de passe incorrect');
      } else {
        const message = await responseMessage(response);
        notify.error(Array.isArray(message) ? message[0] : message);
      }
    } catch (err) {
      notify.error(NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) return;

    const values = { ...change, code: change.code.replace(/\s+/g, '') };
    const result = passwordChangeCodeSchema.safeParse(values);
    if (!result.success) {
      notify.error(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/password/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge: pending.challenge, code: values.code, newPassword: values.newPassword }),
        credentials: 'include',
      });

      if (response.ok) {
        openSession(await response.json(), 'Nouveau mot de passe enregistré : vous êtes connecté.');
        return;
      }
      const message = await responseMessage(response);
      notify.error(Array.isArray(message) ? message[0] : message);
      if (response.status === 410) {
        // Code expiré ou essais épuisés : retour à la connexion pour en recevoir un nouveau.
        setPending(null);
      }
    } catch (err) {
      notify.error(NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  if (accessToken) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg">
        <h1 className="text-2xl font-bold text-white text-center mb-6">BlackStore Admin</h1>
        {pending ? (
          <form onSubmit={handleChange} className="space-y-4">
            <div className="rounded-md border border-orange-500/40 bg-gray-900 px-4 py-3 text-sm text-gray-300" role="status">
              <p className="font-semibold text-white">Votre mot de passe doit être remplacé</p>
              <p className="mt-1">
                Par sécurité, l'ancien mot de passe ne suffit plus. Un code à 6 chiffres vient d'être envoyé à{' '}
                <span className="font-medium text-white">{pending.sentTo}</span> : il est valable{' '}
                {pending.expiresInMinutes} minutes. Pensez à regarder dans les courriers indésirables.
              </p>
            </div>
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-1">
                Code reçu par e-mail
              </label>
              <input
                id="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={9}
                value={change.code}
                onChange={(e) => setChange({ ...change, code: e.target.value })}
                className={`${INPUT_CLASS} tracking-[0.4em]`}
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-1">
                Nouveau mot de passe (12 caractères minimum)
              </label>
              <input
                id="newPassword"
                type="password"
                required
                autoComplete="new-password"
                value={change.newPassword}
                onChange={(e) => setChange({ ...change, newPassword: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                Confirmer le nouveau mot de passe
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={change.confirmPassword}
                onChange={(e) => setChange({ ...change, confirmPassword: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <button type="submit" disabled={loading} className={BUTTON_CLASS}>
              {loading ? 'Enregistrement...' : 'Enregistrer et me connecter'}
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="w-full text-sm text-gray-400 hover:text-white"
            >
              Pas reçu de code ? Revenir à la connexion
            </button>
          </form>
        ) : (
          <>
            {sessionExpired && (
              <p className="mb-4 rounded-md border border-gray-600 bg-gray-900 px-4 py-3 text-sm text-gray-300" role="status">
                Votre session a expiré : reconnectez-vous pour continuer.
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                  Mot de passe
                </label>
                <input
                  type="password"
                  id="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <button type="submit" disabled={loading} className={BUTTON_CLASS}>
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
