"use client";

import { useEffect, useState } from 'react';
import { LayoutGrid, Mail, XCircle } from 'lucide-react';
import { ErrorPanel } from '@/components/errors/error-panel';

interface PendingOrder {
  orderNumber: string;
  buyerEmail: string;
}

/** Paiement refusé ou annulé chez l'opérateur : rien n'est livré pour cette commande. */
export function OrderFailureClient() {
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);

  useEffect(() => {
    const pendingOrderData = sessionStorage.getItem('blackstore_pending_order');
    if (pendingOrderData) {
      try {
        const parsedOrder = JSON.parse(pendingOrderData);
        setPendingOrder(parsedOrder);
      } catch (err) {
        console.error("Erreur lors de l'analyse des données de la commande en attente :", err);
      }
    }
  }, []);

  const contactHref = `/contact?sujet=order${pendingOrder?.orderNumber ? `&commande=${encodeURIComponent(pendingOrder.orderNumber)}` : ''}`;

  return (
    <ErrorPanel
      icon={XCircle}
      tone="danger"
      eyebrow="Paiement non abouti"
      title="Votre paiement n'a pas abouti"
      details={pendingOrder?.orderNumber ? [{ label: 'Référence', value: pendingOrder.orderNumber }] : undefined}
      primary={{ label: 'Retour au catalogue', href: '/', icon: LayoutGrid }}
      secondary={{ label: 'Nous contacter', href: contactHref, icon: Mail }}
      helpHref={null}
    >
      <p>
        Le paiement a été refusé ou annulé : cette commande n&apos;est pas payée et ne donne pas accès au téléchargement. Vous pouvez recommencer votre achat
        depuis le catalogue.
      </p>
      <p>Votre compte Mobile Money a quand même été débité ? Écrivez-nous avec la référence de la commande : nous vérifierons auprès de l&apos;opérateur.</p>
    </ErrorPanel>
  );
}
