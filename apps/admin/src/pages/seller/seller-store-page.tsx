import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import { slugify, type SellerProfile, type SellerStore } from '@/lib/seller-api';
import { sellerStoreSchema } from '@/lib/validations';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage, BUTTON_CLASS, FormField, INPUT_CLASS } from '@/components/form-field';

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const EMPTY_FORM = { name: '', slug: '', description: '', facebookUrl: '', instagramUrl: '', tiktokUrl: '', whatsapp: '' };
type StoreForm = typeof EMPTY_FORM;

const toForm = (store: SellerStore): StoreForm => ({
  name: store.name,
  slug: store.slug,
  description: store.description ?? '',
  facebookUrl: store.facebookUrl ?? '',
  instagramUrl: store.instagramUrl ?? '',
  tiktokUrl: store.tiktokUrl ?? '',
  whatsapp: store.whatsapp ?? '',
});

export function SellerStorePage() {
  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();
  const { data: storeData, isLoading, isError } = useQuery({
    queryKey: ['seller-store'],
    queryFn: () => api.get<{ store: SellerStore | null }>('/seller/store', accessToken),
  });
  const { data: me } = useQuery({
    queryKey: ['seller-me'],
    queryFn: () => api.get<SellerProfile>('/seller/me', accessToken),
  });
  const store = storeData?.store ?? null;

  const [form, setForm] = useState<StoreForm>(EMPTY_FORM);
  // Pour une nouvelle boutique, l'adresse suit le nom tant que le vendeur ne l'a pas modifiée.
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // On ne recopie dans le formulaire que les champs enregistrés : l'adresse du logo change à chaque
  // chargement (lien signé), et l'envoi d'un logo ne doit pas effacer une saisie en cours.
  const savedForm = store ? JSON.stringify(toForm(store)) : null;
  useEffect(() => {
    if (savedForm) {
      setForm(JSON.parse(savedForm));
      setSlugTouched(true);
    }
  }, [savedForm]);

  const set = (field: keyof StoreForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'name' && !slugTouched ? { slug: slugify(value) } : {}),
    }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = sellerStoreSchema.safeParse(form);
    if (!result.success) {
      notify.error(result.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      const saved = await api.put<SellerStore>('/seller/store', result.data, accessToken);
      queryClient.setQueryData(['seller-store'], { store: saved });
      queryClient.invalidateQueries({ queryKey: ['seller-me'] });
      notify.success(store ? 'Boutique enregistrée' : 'Boutique créée');
    } catch (err) {
      notify.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      notify.error('Le logo doit être une image JPG, PNG ou WebP');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      notify.error('Le logo doit faire au plus 2 Mo');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const saved = await api.postForm<SellerStore>('/seller/store/logo', formData, accessToken);
      queryClient.setQueryData(['seller-store'], { store: saved });
      notify.success('Logo enregistré');
    } catch (err) {
      notify.error(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;
  if (isError) return <p className="text-sm text-red-600">Impossible de charger votre boutique. Rechargez la page.</p>;

  const approved = me?.status === 'approved';

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Ma boutique</h1>

      {store && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            approved
              ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
              : 'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200'
          }`}
        >
          {approved ? (
            <>
              Votre boutique est en ligne :{' '}
              <a href={store.publicUrl} target="_blank" rel="noreferrer" className="font-medium underline">
                {store.publicUrl}
              </a>
            </>
          ) : (
            'Votre boutique sera visible sur le site dès que votre compte vendeur sera validé.'
          )}
        </div>
      )}

      <form onSubmit={save} className="space-y-4 rounded-lg border bg-background p-4" noValidate>
        <h2 className="text-sm font-semibold">Informations</h2>
        <FormField label="Nom de la boutique" id="name" value={form.name} onChange={set('name')} />
        <div>
          <label htmlFor="slug" className="mb-1 block text-sm font-medium">Adresse de la boutique</label>
          <div className="flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-primary">
            <span className="pl-3 text-sm text-muted-foreground">/boutique/</span>
            <input
              id="slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm({ ...form, slug: e.target.value.toLowerCase() });
              }}
              className="w-full bg-transparent px-1 py-2 text-sm outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Lettres minuscules sans accent, chiffres et tirets. Changer l'adresse rend les liens déjà partagés inutilisables.
          </p>
        </div>
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            id="description"
            rows={4}
            maxLength={1000}
            value={form.description}
            onChange={set('description')}
            placeholder="Ce que vous vendez, pour qui, ce qui vous distingue…"
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{form.description.length} / 1 000</p>
        </div>

        <h2 className="pt-2 text-sm font-semibold">Réseaux sociaux (facultatif)</h2>
        <FormField label="Facebook" id="facebookUrl" type="url" placeholder="https://www.facebook.com/votre-page" value={form.facebookUrl} onChange={set('facebookUrl')} />
        <FormField label="Instagram" id="instagramUrl" type="url" placeholder="https://www.instagram.com/votre-compte" value={form.instagramUrl} onChange={set('instagramUrl')} />
        <FormField label="TikTok" id="tiktokUrl" type="url" placeholder="https://www.tiktok.com/@votre-compte" value={form.tiktokUrl} onChange={set('tiktokUrl')} />
        <FormField label="WhatsApp" id="whatsapp" type="tel" placeholder="6 99 00 00 00" value={form.whatsapp} onChange={set('whatsapp')} />

        <button type="submit" disabled={saving} className={BUTTON_CLASS}>
          {saving ? 'Enregistrement...' : store ? 'Enregistrer' : 'Créer ma boutique'}
        </button>
      </form>

      <section className="space-y-3 rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">Logo</h2>
        {store ? (
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {store.logoUrl ? (
                <img src={store.logoUrl} alt={`Logo de ${store.name}`} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground">Aucun logo</span>
              )}
            </div>
            <div className="space-y-1">
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} className="hidden" />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                {uploading ? 'Envoi...' : store.logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
              </button>
              <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, 2 Mo maximum. Une image carrée rend mieux.</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Créez d'abord votre boutique, puis ajoutez son logo.</p>
        )}
      </section>
    </div>
  );
}
