const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

export async function fetchCategories(): Promise<CategorySummary[]> {
  const res = await fetch(`${API}/categories`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Erreur chargement catégories');
  return res.json();
}