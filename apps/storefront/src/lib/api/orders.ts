const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface CreateOrderPayload {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: Array<{ productId: string; quantity: number }>;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  referrer_url?: string;
}

export interface OrderCreatedResponse {
  id: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

export interface InitiatePaymentPayload {
  orderId: string;
  currency: 'XAF';
}

export interface InitiatePaymentResponse {
  paymentToken: string;
  paymentUrl: string;
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<OrderCreatedResponse> {
  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Erreur création commande');
  }
  return res.json();
}

export async function initiatePayment(
  payload: InitiatePaymentPayload,
): Promise<InitiatePaymentResponse> {
  const res = await fetch(`${API}/payments/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Erreur initialisation paiement');
  }
  return res.json();
}