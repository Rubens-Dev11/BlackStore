/**
 * Format an amount in FCFA (XAF) for display.
 * Example: 5000 → "5 000 FCFA"
 */
export function formatFcfa(amount: number): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(amount);

  return `${formatted} FCFA`;
}
