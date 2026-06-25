/**
 * Formate un montant en FCFA
 * Copie locale de @/lib/format/utils/format
 * (le package workspace n'est pas résolu dans le container Docker)
 */
export function formatFcfa(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}