import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatFcfa, type CategoryWithCount } from '@/lib/format';
import { notify } from '@/lib/toast';
import {
  PLATFORM_LABELS,
  SELLER_FILE_MAX_BYTES,
  SELLER_IMAGE_MAX_BYTES,
  SELLER_IMAGE_TYPES,
  sellerProductState,
  TONE_CLASSES,
  type ProductPlatform,
  type SellerProduct,
} from '@/lib/seller-api';
import { sellerProductSchema } from '@/lib/validations';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage, BUTTON_CLASS, FormField, INPUT_CLASS } from '@/components/form-field';

const SECTION_CLASS = 'space-y-4 rounded-lg border bg-background p-4';
const SECONDARY_BUTTON = 'rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50';

const EMPTY_FORM = {
  name: '',
  shortDescription: '',
  description: '',
  categoryId: '',
  platform: 'multiplatform' as ProductPlatform,
  isFree: false,
  price: '',
  originalPrice: '',
  version: '',
  tags: '',
};
type ProductForm = typeof EMPTY_FORM;

const toForm = (p: SellerProduct): ProductForm => ({
  name: p.name,
  shortDescription: p.shortDescription ?? '',
  description: p.description ?? '',
  categoryId: p.categoryId ?? '',
  platform: p.platform,
  isFree: p.price === 0,
  price: p.price === 0 ? '' : String(p.price),
  originalPrice: p.originalPrice !== null ? String(p.originalPrice) : '',
  version: p.version ?? '',
  tags: p.tags.join(', '),
});

/** Formulaire → données envoyées à l'API (validées comme côté serveur). */
function toPayload(form: ProductForm) {
  const number = (value: string) => (value.trim() === '' ? Number.NaN : Number(value.replace(/\s/g, '')));
  return sellerProductSchema.safeParse({
    name: form.name,
    shortDescription: form.shortDescription,
    description: form.description,
    categoryId: form.categoryId,
    platform: form.platform,
    price: form.isFree ? 0 : number(form.price),
    originalPrice: form.isFree || form.originalPrice.trim() === '' ? null : number(form.originalPrice),
    version: form.version,
    tags: form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  });
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${value}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{value} %</p>
    </div>
  );
}

const formatSize = (mb: number | null) => (mb === null ? '' : mb < 1 ? `${Math.round(mb * 1024)} Ko` : `${mb.toLocaleString('fr-FR')} Mo`);

export function SellerProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['seller-product', id],
    queryFn: () => api.get<SellerProduct>(`/seller/products/${id}`, accessToken),
    enabled: !isNew,
    // Pendant l'analyse antivirus, l'état est relu toutes les 4 secondes.
    refetchInterval: (query) => (query.state.data?.scanStatus === 'pending' ? 4000 : false),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<CategoryWithCount[]>('/categories', accessToken),
  });

  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [coverProgress, setCoverProgress] = useState<number | null>(null);
  const [screenshotsProgress, setScreenshotsProgress] = useState<number | null>(null);
  const [fileProgress, setFileProgress] = useState<number | null>(null);
  const [certified, setCertified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const screenshotsInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Le formulaire reprend les valeurs enregistrées, sans écraser une saisie en cours
  // quand seuls l'état ou les images changent (analyse, envoi d'une couverture…).
  const savedForm = product ? JSON.stringify(toForm(product)) : null;
  useEffect(() => {
    if (savedForm) setForm(JSON.parse(savedForm));
  }, [savedForm]);

  const set = (field: keyof ProductForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const store = (updated: SellerProduct) => {
    queryClient.setQueryData(['seller-product', updated.id], updated);
    queryClient.invalidateQueries({ queryKey: ['seller-products'] });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = toPayload(form);
    if (!result.success) {
      notify.error(result.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await api.post<SellerProduct>('/seller/products', result.data, accessToken);
        store(created);
        notify.success('Brouillon créé : ajoutez maintenant la couverture et le fichier');
        navigate(`/vendeur/produits/${created.id}`, { replace: true });
      } else {
        store(await api.patch<SellerProduct>(`/seller/products/${id}`, result.data, accessToken));
        notify.success('Produit enregistré');
      }
    } catch (err) {
      notify.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (
    path: string,
    files: File[],
    field: 'file' | 'files',
    onProgress: (value: number | null) => void,
    success: string,
  ) => {
    const body = new FormData();
    files.forEach((file) => body.append(field, file));
    onProgress(0);
    try {
      store(await api.postFormWithProgress<SellerProduct>(`/seller/products/${id}/${path}`, body, accessToken, onProgress));
      notify.success(success);
    } catch (err) {
      notify.error(apiErrorMessage(err));
    } finally {
      onProgress(null);
    }
  };

  const checkImages = (files: File[]) => {
    const wrong = files.find((f) => !SELLER_IMAGE_TYPES.includes(f.type));
    if (wrong) return `${wrong.name} : les images doivent être au format JPG, PNG ou WebP`;
    const big = files.find((f) => f.size > SELLER_IMAGE_MAX_BYTES);
    if (big) return `${big.name} : 5 Mo maximum par image`;
    return null;
  };

  const onCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const problem = checkImages(files);
    if (problem) return notify.error(problem);
    void upload('cover', files, 'file', setCoverProgress, 'Couverture enregistrée');
  };

  const onScreenshots = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (files.length > 8) return notify.error("8 captures d'écran au maximum");
    const problem = checkImages(files);
    if (problem) return notify.error(problem);
    void upload('screenshots', files, 'files', setScreenshotsProgress, "Captures d'écran enregistrées");
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size === 0) return notify.error('Le fichier est vide');
    if (file.size > SELLER_FILE_MAX_BYTES) return notify.error('Le fichier doit faire au plus 450 Mo. Compressez-le ou découpez-le.');
    void upload('file', [file], 'file', setFileProgress, "Fichier envoyé : l'antivirus l'analyse");
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const updated = await api.post<SellerProduct>(`/seller/products/${id}/submit`, { certifyRights: certified }, accessToken);
      store(updated);
      notify.success(
        updated.reviewStatus === 'approved'
          ? 'Produit publié'
          : "Produit envoyé pour validation : vous recevrez un e-mail dès que l'équipe l'aura examiné",
      );
    } catch (err) {
      notify.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isNew && isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;
  if (!isNew && (isError || !product)) {
    return <p className="text-sm text-red-600">Produit introuvable. <Link to="/vendeur/produits" className="underline">Retour à mes produits</Link></p>;
  }

  const state = product ? sellerProductState(product) : null;
  const canSubmit = product && (product.reviewStatus === 'draft' || product.reviewStatus === 'rejected');
  const requirements = product
    ? [
        { ok: (product.description?.trim().length ?? 0) >= 30, label: 'Une description de 30 caractères au moins (enregistrée)' },
        { ok: !!product.categoryId, label: 'Une catégorie' },
        { ok: !!product.coverUrl, label: 'Une image de couverture' },
        { ok: !!product.file && product.scanStatus === 'clean', label: "Le fichier du produit, vérifié par l'antivirus" },
      ]
    : [];
  const ready = requirements.every((r) => r.ok);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/vendeur/produits" className="text-sm text-muted-foreground hover:text-foreground">← Mes produits</Link>
        <h1 className="text-2xl font-bold">{isNew ? 'Nouveau produit' : product!.name}</h1>
        {state && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[state.tone]}`}>{state.label}</span>}
      </div>

      {product && <StatusBanner product={product} />}

      <form onSubmit={save} className={SECTION_CLASS} noValidate>
        <h2 className="text-sm font-semibold">Informations</h2>
        <FormField label="Nom du produit" id="name" value={form.name} onChange={set('name')} maxLength={120} placeholder="Ex. : Pack de 50 modèles Canva pour commerçants" />
        <div>
          <label htmlFor="shortDescription" className="mb-1 block text-sm font-medium">Accroche (facultatif)</label>
          <input id="shortDescription" value={form.shortDescription} onChange={set('shortDescription')} maxLength={160} className={INPUT_CLASS} placeholder="Une phrase affichée dans le catalogue" />
          <p className="mt-1 text-right text-xs text-muted-foreground">{form.shortDescription.length} / 160</p>
        </div>
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            id="description"
            rows={8}
            maxLength={5000}
            value={form.description}
            onChange={set('description')}
            className={INPUT_CLASS}
            placeholder={'Ce que contient le produit, pour qui, comment l\'utiliser…\n\nLaissez une ligne vide entre deux paragraphes.'}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{form.description.length} / 5 000</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="categoryId" className="mb-1 block text-sm font-medium">Catégorie</label>
            <select id="categoryId" value={form.categoryId} onChange={set('categoryId')} className={INPUT_CLASS}>
              <option value="">— Choisir —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="platform" className="mb-1 block text-sm font-medium">Utilisable sur</label>
            <select id="platform" value={form.platform} onChange={set('platform')} className={INPUT_CLASS}>
              {(Object.keys(PLATFORM_LABELS) as ProductPlatform[]).map((p) => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isFree} onChange={set('isFree')} />
          Produit gratuit
        </label>
        {!form.isFree && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Prix (FCFA)" id="price" inputMode="numeric" value={form.price} onChange={set('price')} placeholder="Ex. : 2500" />
            <FormField label="Prix barré (facultatif)" id="originalPrice" inputMode="numeric" value={form.originalPrice} onChange={set('originalPrice')} placeholder="Prix avant réduction" />
          </div>
        )}
        {!form.isFree && (
          <p className="text-xs text-muted-foreground">
            100 FCFA minimum, multiple de 5. BlackStore prélève une commission de 10 % sur chaque vente.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Version (facultatif)" id="version" value={form.version} onChange={set('version')} maxLength={20} placeholder="Ex. : 2.1" />
          <FormField label="Mots-clés (facultatif, séparés par des virgules)" id="tags" value={form.tags} onChange={set('tags')} placeholder="canva, modèles, commerce" />
        </div>
        <button type="submit" disabled={saving} className={BUTTON_CLASS}>
          {saving ? 'Enregistrement...' : isNew ? 'Créer le brouillon' : 'Enregistrer'}
        </button>
      </form>

      {isNew ? (
        <p className="text-sm text-muted-foreground">Après la création du brouillon, vous pourrez ajouter les images et le fichier.</p>
      ) : (
        <>
          <section className={SECTION_CLASS}>
            <h2 className="text-sm font-semibold">Images</h2>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-md border bg-muted">
                {product!.coverUrl ? (
                  <img src={product!.coverUrl} alt="Couverture" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">Aucune couverture</span>
                )}
              </div>
              <div className="space-y-1">
                <input ref={coverInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={onCover} className="hidden" />
                <button type="button" disabled={coverProgress !== null} onClick={() => coverInput.current?.click()} className={SECONDARY_BUTTON}>
                  {product!.coverUrl ? 'Changer la couverture' : 'Ajouter une couverture'}
                </button>
                <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, 5 Mo maximum. Format paysage conseillé (16/9).</p>
              </div>
            </div>
            {coverProgress !== null && <ProgressBar value={coverProgress} />}

            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Captures d'écran (facultatif, 8 au maximum)</p>
              {product!.screenshotUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product!.screenshotUrls.map((url, i) => (
                    <img key={url} src={url} alt={`Capture ${i + 1}`} className="h-16 w-28 rounded-md border object-cover" />
                  ))}
                </div>
              )}
              <input ref={screenshotsInput} type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={onScreenshots} className="hidden" />
              <button type="button" disabled={screenshotsProgress !== null} onClick={() => screenshotsInput.current?.click()} className={SECONDARY_BUTTON}>
                {product!.screenshotUrls.length > 0 ? 'Remplacer les captures' : 'Ajouter des captures'}
              </button>
              {screenshotsProgress !== null && <ProgressBar value={screenshotsProgress} />}
            </div>
          </section>

          <section className={SECTION_CLASS}>
            <h2 className="text-sm font-semibold">Fichier vendu</h2>
            <FileStatus product={product!} />
            <input ref={fileInput} type="file" onChange={onFile} className="hidden" />
            <button type="button" disabled={fileProgress !== null} onClick={() => fileInput.current?.click()} className={SECONDARY_BUTTON}>
              {product!.file ? 'Remplacer le fichier' : 'Envoyer le fichier'}
            </button>
            <p className="text-xs text-muted-foreground">
              450 Mo maximum : PDF, EPUB, Word, Excel, images, audio, vidéo, ZIP, RAR, APK, EXE… Pour un autre format,
              compressez-le en ZIP. Chaque fichier est analysé par un antivirus avant d'être proposé aux acheteurs.
            </p>
            {fileProgress !== null && <ProgressBar value={fileProgress} />}
          </section>

          {canSubmit && (
            <section className={SECTION_CLASS}>
              <h2 className="text-sm font-semibold">{product!.reviewStatus === 'rejected' ? 'Soumettre à nouveau' : 'Mettre en vente'}</h2>
              <ul className="space-y-1 text-sm">
                {requirements.map((r) => (
                  <li key={r.label} className={r.ok ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}>
                    {r.ok ? '✓' : '○'} {r.label}
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={certified} onChange={(e) => setCertified(e.target.checked)} />
                <span>
                  Je certifie détenir les droits de vente de ce produit (j'en suis l'auteur ou j'ai une licence de revente). Les
                  copies d'applications ou de logiciels payants ne sont pas acceptées.
                </span>
              </label>
              <button type="button" disabled={!ready || !certified || submitting} onClick={submit} className={BUTTON_CLASS}>
                {submitting ? 'Envoi...' : 'Soumettre le produit'}
              </button>
              <p className="text-xs text-muted-foreground">
                Votre premier produit est vérifié par l'équipe BlackStore avant sa mise en ligne. Ensuite, vos produits sont publiés
                directement.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Explication de l'état du produit et de ce qu'il reste à faire. */
function StatusBanner({ product }: { product: SellerProduct }) {
  let tone: 'yellow' | 'green' | 'red' | 'gray' = 'gray';
  let text: React.ReactNode = null;
  if (product.reviewStatus === 'draft') {
    text = 'Brouillon : complétez les informations, ajoutez la couverture et le fichier, puis soumettez le produit.';
  } else if (product.reviewStatus === 'pending') {
    tone = 'yellow';
    text = "En attente de validation par l'équipe BlackStore. Vous recevrez un e-mail dès qu'il aura été examiné.";
  } else if (product.reviewStatus === 'rejected') {
    tone = 'red';
    text = (
      <>
        Produit refusé{product.reviewNote ? <> : <strong>{product.reviewNote}</strong></> : null}. Corrigez-le puis soumettez-le à nouveau.
      </>
    );
  } else if (product.isPublic) {
    tone = 'green';
    text = (
      <>
        En vente sur le site :{' '}
        <a href={product.publicUrl} target="_blank" rel="noreferrer" className="font-medium underline">{product.publicUrl}</a>
        {' · '}
        {product.price === 0 ? 'Gratuit' : formatFcfa(product.price)}
      </>
    );
  } else if (!product.isActive) {
    text = 'Produit validé mais masqué : il n’apparaît pas sur le site. Affichez-le depuis « Mes produits ».';
  } else if (product.scanStatus !== 'clean') {
    tone = 'yellow';
    text = "Produit validé : il réapparaîtra sur le site dès que l'antivirus aura vérifié le nouveau fichier.";
  } else {
    tone = 'yellow';
    text = 'Produit validé : il sera visible sur le site dès que votre compte vendeur sera validé.';
  }
  return <div className={`rounded-lg border px-4 py-3 text-sm ${TONE_CLASSES[tone]}`}>{text}</div>;
}

function FileStatus({ product }: { product: SellerProduct }) {
  if (product.scanStatus === 'infected') {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
        L'antivirus a détecté une menace{product.scanThreat ? ` (${product.scanThreat})` : ''} : le fichier a été supprimé. Envoyez une
        version saine.
      </p>
    );
  }
  if (!product.file) {
    return <p className="text-sm text-muted-foreground">Aucun fichier pour l'instant.</p>;
  }
  const scan: Record<string, { text: string; className: string }> = {
    pending: { text: 'Analyse antivirus en cours…', className: 'text-blue-700 dark:text-blue-300' },
    clean: { text: 'Vérifié par l’antivirus ✓', className: 'text-green-700 dark:text-green-400' },
    failed: { text: "Analyse impossible pour le moment : l'équipe BlackStore relancera l'analyse.", className: 'text-yellow-700 dark:text-yellow-300' },
  };
  const status = scan[product.scanStatus ?? 'pending'];
  return (
    <div className="text-sm">
      <p className="font-medium break-all">
        {product.file.name} <span className="font-normal text-muted-foreground">{formatSize(product.file.sizeMb)}</span>
      </p>
      <p className={status.className}>{status.text}</p>
    </div>
  );
}
