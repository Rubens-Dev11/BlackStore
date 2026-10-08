import { PromoCodesManager } from '@/components/promo-codes-manager';
import { useSellerPageTitle } from '@/layouts/seller-auth-card';

/** Codes promo de la boutique du vendeur. */
export function SellerPromoCodesPage() {
  useSellerPageTitle('Codes promo');
  return (
    <PromoCodesManager
      basePath="/seller/promo-codes"
      intro={
        <>
          <p>
            Donnez un code à vos clients (réseaux sociaux, WhatsApp…) : ils le saisissent au moment de payer et obtiennent la réduction sur
            les produits de votre boutique. Un seul code par commande.
          </p>
          <p>
            La réduction est déduite du prix de vente : vos gains et la commission de BlackStore sont calculés sur le prix réellement payé.
          </p>
        </>
      }
    />
  );
}
