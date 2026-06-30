import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/use-auth-store';
import { api } from '@/lib/api';
import { formatFcfa, CategoryWithCount } from '@/lib/format';
import { notify } from '@/lib/toast';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  coverImageUrl: string | null;
  screenshots: string[];
  demoVideoUrl: string | null;
  installGuide: string | null;
  installVideoUrl: string | null;
  price: number;
  originalPrice: number | null;
  categoryId: string | null;
  tags: string[];
  version: string | null;
  fileSizeMb: number | null;
  platform: 'android' | 'desktop' | 'multiplatform';
  isActive: boolean;
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  maxDownloads: number;
  downloadExpiryHours: number;
  filePath: string | null;
}

interface ProductFormData {
  name: string;
  shortDescription: string;
  description: string;
  coverImageUrl: string;
  demoVideoUrl: string;
  installGuide: string;
  installVideoUrl: string;
  price: string;
  originalPrice: string;
  categoryId: string;
  tags: string;
  version: string;
  fileSizeMb: string;
  platform: 'android' | 'desktop' | 'multiplatform';
  isActive: boolean;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  maxDownloads: string;
  downloadExpiryHours: string;
  filePath: string;
}

const EMPTY_FORM: ProductFormData = {
  name: '',
  shortDescription: '',
  description: '',
  coverImageUrl: '',
  demoVideoUrl: '',
  installGuide: '',
  installVideoUrl: '',
  price: '',
  originalPrice: '',
  categoryId: '',
  tags: '',
  version: '',
  fileSizeMb: '',
  platform: 'android',
  isActive: false,
  isFeatured: false,
  seoTitle: '',
  seoDescription: '',
  maxDownloads: '3',
  downloadExpiryHours: '72',
  filePath: '',
};

function productToForm(p: Product): ProductFormData {
  return {
    name: p.name,
    shortDescription: p.shortDescription ?? '',
    description: p.description ?? '',
    coverImageUrl: p.coverImageUrl ?? '',
    demoVideoUrl: p.demoVideoUrl ?? '',
    installGuide: p.installGuide ?? '',
    installVideoUrl: p.installVideoUrl ?? '',
    price: String(p.price),
    originalPrice: p.originalPrice !== null ? String(p.originalPrice) : '',
    categoryId: p.categoryId ?? '',
    tags: p.tags.join(', '),
    version: p.version ?? '',
    fileSizeMb: p.fileSizeMb !== null ? String(p.fileSizeMb) : '',
    platform: p.platform,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
    maxDownloads: String(p.maxDownloads),
    downloadExpiryHours: String(p.downloadExpiryHours),
    filePath: p.filePath ?? '',
  };
}

function formToCreatePayload(f: ProductFormData) {
  const description =
    f.description.trim() ||
    f.shortDescription.trim() ||
    `Produit ${f.name.trim()}`;

  return {
    name: f.name.trim(),
    description: description.length >= 10 ? description : `${description} — BlackStore`,
    price: parseInt(f.price, 10),
    categoryId: f.categoryId,
    version: f.version.trim() || undefined,
    downloadLimit: parseInt(f.maxDownloads, 10) || 3,
    downloadExpiryHours: parseInt(f.downloadExpiryHours, 10) || 72,
    isFeatured: f.isFeatured,
    platform: f.platform,
  };
}

function formToUpdatePayload(f: ProductFormData) {
  const description =
    f.description.trim() ||
    f.shortDescription.trim() ||
    undefined;

  return {
    name: f.name.trim(),
    description: description && description.length >= 10
      ? description
      : description
        ? `${description} — BlackStore`
        : undefined,
    price: parseInt(f.price, 10),
    categoryId: f.categoryId || undefined,
    version: f.version.trim() || undefined,
    downloadLimit: parseInt(f.maxDownloads, 10) || undefined,
    downloadExpiryHours: parseInt(f.downloadExpiryHours, 10) || undefined,
    isFeatured: f.isFeatured,
    isActive: f.isActive,
    ...(f.platform && { platform: f.platform }),
  };
}

// ─────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────

import { productSchema } from '@/lib/validations';

function slugify(text: string) {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();

  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<Product>(`/products/by-id/${id}`, accessToken),
    enabled: !!accessToken && isEditing && !!id,
  });

  // Charger les catégories pour le select
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<CategoryWithCount[]>('/categories', accessToken),
    enabled: !!accessToken,
  });

  // Pré-remplir le formulaire en mode édition
  useEffect(() => {
    if (product) {
      setForm(productToForm(product));
    }
  }, [product]);

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof formToCreatePayload>) =>
      api.post<Product>('/products', payload, accessToken),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate(`/produits/${created.id}/modifier`);
      notify.success('Produit créé');
    },
    onError: (_err: unknown) => {
      notify.error('Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof formToUpdatePayload>) =>
      api.patch<Product>(`/products/${id}`, payload, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      navigate('/produits');
      notify.success('Produit mis à jour');
    },
    onError: (_err: unknown) => {
      notify.error('Erreur lors de la modification');
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: (file: File) => {
      const loaderId = notify.loading('Upload en cours...');
      const formData = new FormData();
      formData.append('file', file);
      return api.postForm<Product>(`/products/${id}/upload`, formData, accessToken)
        .then((res) => {
          notify.success('Fichier uploadé ✓', { id: loaderId });
          return res;
        })
        .catch((err) => {
          notify.error('Erreur upload fichier', { id: loaderId });
          throw err;
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
    },
  });

  const uploadScreenshotsMutation = useMutation({
    mutationFn: (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('files', file));
      return api.postForm<Product>(`/products/${id}/upload-screenshots`, formData, accessToken);
    },
    onSuccess: () => {
      notify.success('Captures uploadées');
      queryClient.invalidateQueries({ queryKey: ['product', id] });
    },
    onError: () => {
      notify.error('Erreur upload captures');
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const payload = isEditing ? formToUpdatePayload(form) : formToCreatePayload(form);
    
    // Validation Zod
    const result = productSchema.safeParse({
      ...payload,
      slug: slugify(payload.name),
      shortDescription: form.shortDescription, // On a besoin de valider la shortDescription aussi selon les règles
    });

    if (!result.success) {
      setErrorMsg(result.error.issues[0].message);
      return;
    }

    if (isEditing) {
      updateMutation.mutate(payload as ReturnType<typeof formToUpdatePayload>);
    } else {
      createMutation.mutate(payload as ReturnType<typeof formToCreatePayload>);
    }
  }

  if (productLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Chargement du produit...</p>
      </div>
    );
  }

  const categories = categoriesData ?? [];

  // ─────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/produits')}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour aux produits
        </button>
        <h1 className="text-2xl font-bold">
          {isEditing ? 'Modifier le produit' : 'Nouveau produit'}
        </h1>
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {errorMsg}
        </div>
      )}

      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Section Informations générales ── */}
        <fieldset className="rounded-lg border p-4">
          <legend className="mb-3 px-2 text-sm font-semibold">Informations générales</legend>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">
              Nom du produit <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: Adobe Photoshop 2026"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Description courte</label>
            <input
              name="shortDescription"
              value={form.shortDescription}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="Accroche visible sur la liste produits (max ~150 car.)"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Description complète</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={5}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="Description détaillée du produit (HTML accepté)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Catégorie <span className="text-red-500">*</span>
              </label>
              <select
                name="categoryId"
                value={form.categoryId}
                onChange={handleChange}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— Aucune catégorie —</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Plateforme</label>
              <select
                name="platform"
                value={form.platform}
                onChange={handleChange}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="android">📱 Android</option>
                <option value="desktop">💻 Desktop</option>
                <option value="multiplatform">🌐 Multiplateforme</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* ── Section Prix ── */}
        <fieldset className="rounded-lg border p-4">
          <legend className="mb-3 px-2 text-sm font-semibold">Prix</legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Prix en FCFA <span className="text-red-500">*</span>
              </label>
              <input
                name="price"
                type="number"
                min="1"
                value={form.price}
                onChange={handleChange}
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ex: 5000"
              />
              {form.price && !isNaN(parseInt(form.price)) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  = {formatFcfa(parseInt(form.price))}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Prix barré (optionnel)
              </label>
              <input
                name="originalPrice"
                type="number"
                min="1"
                value={form.originalPrice}
                onChange={handleChange}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ex: 8000 (si promo)"
              />
            </div>
          </div>
        </fieldset>

        {/* ── Section Médias ── */}
        <fieldset className="rounded-lg border p-4">
          <legend className="mb-3 px-2 text-sm font-semibold">Médias</legend>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">URL image de couverture</label>
            <input
              name="coverImageUrl"
              type="url"
              value={form.coverImageUrl}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://..."
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">URL vidéo démo</label>
            <input
              name="demoVideoUrl"
              type="url"
              value={form.demoVideoUrl}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>
        </fieldset>

        {/* ── Section Fichier & Distribution ── */}
        <fieldset className="rounded-lg border p-4">
          <legend className="mb-3 px-2 text-sm font-semibold">Fichier & Distribution</legend>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Chemin du fichier (MinIO)</label>
            <input
              name="filePath"
              value={form.filePath}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary"
              placeholder="products/mon-app-v1.apk"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Chemin relatif dans le bucket MinIO <code>blackstore</code>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Version</label>
              <input
                name="version"
                value={form.version}
                onChange={handleChange}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="1.0.0"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Taille (Mo)</label>
              <input
                name="fileSizeMb"
                type="number"
                min="0"
                step="0.1"
                value={form.fileSizeMb}
                onChange={handleChange}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="45.5"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Max téléchargements</label>
              <input
                name="maxDownloads"
                type="number"
                min="1"
                value={form.maxDownloads}
                onChange={handleChange}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Expiration des liens (heures)</label>
            <input
              name="downloadExpiryHours"
              type="number"
              min="1"
              value={form.downloadExpiryHours}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Durée de validité des tokens de téléchargement après paiement
            </p>
          </div>
        </fieldset>

        {/* ── Section Guide d'installation ── */}
        <fieldset className="rounded-lg border p-4">
          <legend className="mb-3 px-2 text-sm font-semibold">Guide d'installation</legend>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Instructions d'installation</label>
            <textarea
              name="installGuide"
              value={form.installGuide}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="Étapes d'installation pour l'utilisateur..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">URL vidéo d'installation</label>
            <input
              name="installVideoUrl"
              type="url"
              value={form.installVideoUrl}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>
        </fieldset>

        {/* ── Section SEO & Tags ── */}
        <fieldset className="rounded-lg border p-4">
          <legend className="mb-3 px-2 text-sm font-semibold">SEO & Tags</legend>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Tags (séparés par des virgules)</label>
            <input
              name="tags"
              value={form.tags}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="android, gratuit, photoshop, 2026"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">
              Titre SEO <span className="text-xs text-muted-foreground">(max 70 car.)</span>
            </label>
            <input
              name="seoTitle"
              maxLength={70}
              value={form.seoTitle}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="Télécharger Photoshop 2026 APK — BlackStore"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {form.seoTitle.length}/70
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Description SEO <span className="text-xs text-muted-foreground">(max 160 car.)</span>
            </label>
            <textarea
              name="seoDescription"
              maxLength={160}
              rows={2}
              value={form.seoDescription}
              onChange={handleChange}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="Téléchargez Photoshop 2026 pour Android en FCFA..."
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {form.seoDescription.length}/160
            </p>
          </div>
        </fieldset>

        {/* ── Section Upload (édition uniquement) ── */}
        {isEditing && id && (
          <fieldset className="rounded-lg border p-4">
            <legend className="mb-3 px-2 text-sm font-semibold">Upload fichiers</legend>

            
            {product && product.filePath && (
              <p className="mb-3 text-xs text-muted-foreground">
                Fichier actuel : <code>{product.filePath}</code>
              </p>
            )}

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium">Fichier produit (APK, ZIP…)</label>
              <input
                type="file"
                accept=".apk,.exe,.zip,.dmg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFileMutation.mutate(file);
                }}
                disabled={uploadFileMutation.isPending}
                className="block w-full text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Captures d'écran (max 8)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    uploadScreenshotsMutation.mutate(e.target.files);
                  }
                }}
                disabled={uploadScreenshotsMutation.isPending}
                className="block w-full text-sm"
              />
              {product && product.screenshots && product.screenshots.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.screenshots.map((url) => (
                    <span key={url} className="rounded bg-muted px-2 py-1 text-xs">{url}</span>
                  ))}
                </div>
              )}
            </div>
          </fieldset>
        )}

        {/* ── Section Visibilité ── */}
        <fieldset className="rounded-lg border p-4">
          <legend className="mb-3 px-2 text-sm font-semibold">Visibilité</legend>
          <div className="flex gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={handleChange}
                className="h-4 w-4 rounded"
              />
              <span>Produit actif (visible sur le storefront)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isFeatured"
                checked={form.isFeatured}
                onChange={handleChange}
                className="h-4 w-4 rounded"
              />
              <span>Produit vedette (mis en avant)</span>
            </label>
          </div>
        </fieldset>

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/produits')}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending
              ? 'Enregistrement...'
              : isEditing
              ? 'Enregistrer les modifications'
              : 'Créer le produit'}
          </button>
        </div>
      </form>
    </div>
  );
}
