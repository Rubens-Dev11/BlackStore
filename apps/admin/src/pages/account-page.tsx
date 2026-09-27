import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import { changePasswordSchema } from '@/lib/validations';
import { useAuthStore } from '@/stores/use-auth-store';

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };

const FIELDS: { name: keyof typeof EMPTY_FORM; label: string; autoComplete: string }[] = [
  { name: 'currentPassword', label: 'Mot de passe actuel', autoComplete: 'current-password' },
  { name: 'newPassword', label: 'Nouveau mot de passe (12 caractères minimum)', autoComplete: 'new-password' },
  { name: 'confirmPassword', label: 'Confirmer le nouveau mot de passe', autoComplete: 'new-password' },
];

export function AccountPage() {
  const navigate = useNavigate();
  const { accessToken, clearAuth } = useAuthStore();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = changePasswordSchema.safeParse(form);
    if (!result.success) {
      notify.error(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      await api.patch(
        '/auth/password',
        { currentPassword: form.currentPassword, newPassword: form.newPassword },
        accessToken,
      );
      // Le changement ferme toutes les sessions, y compris celle-ci.
      clearAuth();
      notify.success('Mot de passe modifié. Reconnectez-vous avec le nouveau mot de passe.');
      navigate('/login');
    } catch (err: any) {
      // Les erreurs de validation de l'API arrivent sous forme de tableau.
      const message = Array.isArray(err?.message) ? err.message[0] : err?.message;
      notify.error(message || 'Erreur serveur. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Mon compte</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">Changer le mot de passe</h2>
        {FIELDS.map((field) => (
          <div key={field.name}>
            <label htmlFor={field.name} className="mb-1 block text-sm font-medium">
              {field.label}
            </label>
            <input
              id={field.name}
              type="password"
              required
              autoComplete={field.autoComplete}
              value={form[field.name]}
              onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Après le changement, toutes les sessions ouvertes sont fermées : il faudra vous reconnecter
          avec le nouveau mot de passe.
        </p>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : 'Changer le mot de passe'}
        </button>
      </form>
    </div>
  );
}
