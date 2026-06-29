import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/use-auth-store';
import { api } from '@/lib/api';
import { CategoryWithCount } from '@/lib/format';
import { notify } from '@/lib/toast';
import { categorySchema } from '@/lib/validations';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CategoryFormData {
  name: string;
  description: string;
  iconUrl: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: CategoryFormData = {
  name: '',
  description: '',
  iconUrl: '',
  sortOrder: '0',
  isActive: true,
};

function categoryToForm(c: CategoryWithCount): CategoryFormData {
  return {
    name: c.name,
    description: c.description ?? '',
    iconUrl: c.iconUrl ?? '',
    sortOrder: String(c.sortOrder),
    isActive: c.isActive,
  };
}

function formToPayload(f: CategoryFormData) {
  return {
    name: f.name.trim(),
    description: f.description.trim() || null,
    iconUrl: f.iconUrl.trim() || null,
    sortOrder: parseInt(f.sortOrder, 10) || 0,
    isActive: f.isActive,
  };
}

function slugify(text: string) {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────

export function CategoriesPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithCount | null>(null);
  const [form, setForm] = useState<CategoryFormData>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<CategoryWithCount[]>('/categories', accessToken),
    enabled: !!accessToken,
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof formToPayload>) =>
      api.post<CategoryWithCount>('/categories', payload, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeForm();
      notify.success('Catégorie créée');
    },
    onError: (_err: unknown) => {
      notify.error('Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReturnType<typeof formToPayload> }) =>
      api.patch<CategoryWithCount>(`/categories/${id}`, payload, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeForm();
      notify.success('Catégorie mise à jour');
    },
    onError: (_err: unknown) => {
      notify.error('Erreur lors de la modification');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/categories/${id}`, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeletingId(null);
      notify.success('Catégorie supprimée');
    },
    onError: (_err: unknown) => {
      notify.error('Erreur lors de la suppression');
      setDeletingId(null);
    },
  });

  function openCreate() {
    setEditingCategory(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(cat: CategoryWithCount) {
    setEditingCategory(cat);
    setForm(categoryToForm(cat));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingCategory(null);
    setForm(EMPTY_FORM);
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
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
    
    const payload = formToPayload(form);
    const result = categorySchema.safeParse({
      ...payload,
      slug: slugify(payload.name),
    });

    if (!result.success) {
      notify.error(result.error.issues[0].message);
      return;
    }

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function confirmDelete(cat: CategoryWithCount) {
    if (cat._count.products > 0) {
      notify.error(`Impossible de supprimer "${cat.name}" : ${cat._count.products} produit(s) y sont associés. Déplacez d'abord les produits vers une autre catégorie.`);
      return;
    }
    if (confirm(`Supprimer la catégorie "${cat.name}" ? Cette action est irréversible.`)) {
      setDeletingId(cat.id);
      deleteMutation.mutate(cat.id);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ─────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catégories</h1>
        <button
          onClick={openCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Nouvelle catégorie
        </button>
      </div>

      {/* Formulaire inline (création ou édition) */}
      {showForm && (
        <div className="mb-6 rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            {editingCategory ? `Modifier « ${editingCategory.name} »` : 'Nouvelle catégorie'}
          </h2>

          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: Applications Android"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Ordre d'affichage</label>
                <input
                  name="sortOrder"
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={handleChange}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Description courte de la catégorie"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">URL icône</label>
              <input
                name="iconUrl"
                type="url"
                value={form.iconUrl}
                onChange={handleChange}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="https://..."
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={handleChange}
                className="h-4 w-4 rounded"
              />
              Catégorie active (visible sur le storefront)
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeForm}
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
                  : editingCategory
                  ? 'Enregistrer'
                  : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des catégories */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : categories.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Aucune catégorie. Créez-en une !</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full rounded-lg border bg-card">
            <thead>
              <tr className="bg-muted/50">
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">
                  Icône
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">
                  Nom / Slug
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">
                  Produits
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">
                  Ordre
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">
                  Statut
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {categories
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((cat) => (
                  <tr key={cat.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4">
                      {cat.iconUrl ? (
                        <img
                          src={cat.iconUrl}
                          alt={cat.name}
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-lg">
                          📂
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{cat.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{cat.slug}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                        {cat._count.products} produit{cat._count.products !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">#{cat.sortOrder}</td>
                    <td className="py-3 px-4">
                      {cat.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-200">
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(cat)}
                          className="rounded px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => confirmDelete(cat)}
                          disabled={deletingId === cat.id}
                          className="rounded px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          {deletingId === cat.id ? '...' : 'Supprimer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
