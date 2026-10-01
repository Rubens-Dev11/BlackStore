import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import type { SellerProfile } from '@/lib/seller-api';
import { sellerChangePasswordSchema, sellerProfileSchema } from '@/lib/validations';
import { useAuthStore } from '@/stores/use-auth-store';

const INPUT_CLASS =
  'w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary';
const BUTTON_CLASS =
  'rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50';

/** Les erreurs de validation de l'API arrivent sous forme de tableau. */
const errorMessage = (err: any) => (Array.isArray(err?.message) ? err.message[0] : err?.message) || 'Erreur serveur. Réessayez.';

function Field({ label, id, ...input }: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={id} {...input} className={INPUT_CLASS} />
    </div>
  );
}

export function SellerAccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { accessToken, clearAuth } = useAuthStore();
  const { data: me } = useQuery({
    queryKey: ['seller-me'],
    queryFn: () => api.get<SellerProfile>('/seller/me', accessToken),
  });

  const [profile, setProfile] = useState({ firstName: '', lastName: '', phone: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (me) setProfile({ firstName: me.firstName, lastName: me.lastName, phone: me.phone });
  }, [me]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = sellerProfileSchema.safeParse(profile);
    if (!result.success) {
      notify.error(result.error.issues[0].message);
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await api.patch<SellerProfile>('/seller/me', result.data, accessToken);
      queryClient.setQueryData(['seller-me'], updated);
      notify.success('Profil enregistré');
    } catch (err) {
      notify.error(errorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = sellerChangePasswordSchema.safeParse(passwords);
    if (!result.success) {
      notify.error(result.error.issues[0].message);
      return;
    }
    setSavingPassword(true);
    try {
      await api.patch('/seller/me/password', { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }, accessToken);
      // Le changement ferme toutes les sessions, y compris celle-ci.
      clearAuth();
      notify.success('Mot de passe modifié. Reconnectez-vous avec le nouveau mot de passe.');
      navigate('/vendeur/connexion', { replace: true });
    } catch (err) {
      notify.error(errorMessage(err));
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Mon compte</h1>

      <form onSubmit={saveProfile} className="space-y-4 rounded-lg border bg-background p-4" noValidate>
        <h2 className="text-sm font-semibold">Informations personnelles</h2>
        <div>
          <p className="mb-1 block text-sm font-medium">E-mail</p>
          <p className="text-sm text-muted-foreground">{me?.email ?? '…'}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom" id="firstName" autoComplete="given-name" value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
          <Field label="Nom" id="lastName" autoComplete="family-name" value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
        </div>
        <Field label="Téléphone (Mobile Money)" id="phone" type="tel" autoComplete="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
        <button type="submit" disabled={savingProfile || !me} className={BUTTON_CLASS}>
          {savingProfile ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>

      <form onSubmit={savePassword} className="space-y-4 rounded-lg border bg-background p-4" noValidate>
        <h2 className="text-sm font-semibold">Changer le mot de passe</h2>
        <Field label="Mot de passe actuel" id="currentPassword" type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} />
        <Field label="Nouveau mot de passe (8 caractères, une lettre et un chiffre)" id="newPassword" type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} />
        <Field label="Confirmer le nouveau mot de passe" id="confirmPassword" type="password" autoComplete="new-password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} />
        <p className="text-xs text-muted-foreground">
          Après le changement, toutes vos sessions ouvertes sont fermées : il faudra vous reconnecter.
        </p>
        <button type="submit" disabled={savingPassword} className={BUTTON_CLASS}>
          {savingPassword ? 'Enregistrement...' : 'Changer le mot de passe'}
        </button>
      </form>
    </div>
  );
}
