import { PromoCodesManager } from '@/components/promo-codes-manager';

/** Codes promo de BlackStore : ils ne s'appliquent qu'aux produits vendus par BlackStore. */
export function PromoCodesPage() {
  return (
    <PromoCodesManager
      basePath="/admin/promo-codes"
      intro={
        <p>
          Codes valables sur les produits vendus par BlackStore (pas sur ceux des vendeurs, qui créent leurs propres codes dans leur
          espace). Un seul code par commande ; le client le saisit au moment de payer.
        </p>
      }
    />
  );
}
