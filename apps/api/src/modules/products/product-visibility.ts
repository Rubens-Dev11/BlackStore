import { Prisma } from '@prisma/client';

/**
 * Produits visibles et achetables sur le site : actifs, validés, et vendus soit
 * par BlackStore, soit par un vendeur validé dont le fichier a passé l'antivirus.
 * Un vendeur suspendu voit donc tous ses produits disparaître du site.
 */
export const PUBLIC_PRODUCT_WHERE = {
  isActive: true,
  reviewStatus: 'approved',
  OR: [{ storeId: null }, { scanStatus: 'clean', store: { seller: { status: 'approved' } } }],
} satisfies Prisma.ProductWhereInput;

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Description d'un vendeur, saisie en texte brut, mise en paragraphes HTML sûrs :
 * la fiche produit affiche la description comme du HTML (celui de l'admin est de confiance,
 * celui d'un vendeur ne l'est pas).
 */
export function plainTextToHtml(text: string | null): string | null {
  if (!text?.trim()) return null;
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}
