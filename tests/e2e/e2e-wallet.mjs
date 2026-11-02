// Essais de bout en bout du portefeuille et des retraits contre l'API de test (port 3100),
// avec le faux CinetPay (port 3998). Usage : BS_ADMIN_PASSWORD=… BS_PG_PASS=… node e2e-wallet.mjs
import { execSync } from 'child_process';

const API = 'http://localhost:3100';
const run = Date.now().toString(36);
let ok = 0;
let ko = 0;
const check = (label, condition, detail) => {
  condition ? ok++ : ko++;
  console.log(`  ${condition ? '✓' : '✗'} ${label}${condition ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
};
const section = (title) => console.log(`\n${title}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (query) =>
  execSync(`docker exec -e PGPASSWORD=${process.env.BS_PG_PASS} bs-test-postgres psql -U bstest -d bstest -tAc "${query.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
  }).trim();

async function call(method, path, { body, token, form, ip = '10.50.0.1' } = {}) {
  const headers = { 'X-Real-IP': ip };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}
const msg = (r) => (Array.isArray(r.json?.message) ? r.json.message[0] : r.json?.message);
const decodeQP = (s) => {
  const soft = s.replace(/=\r?\n/g, '');
  const b = [];
  for (let i = 0; i < soft.length; i++) {
    const h = soft.slice(i + 1, i + 3);
    if (soft[i] === '=' && /^[0-9A-F]{2}$/i.test(h)) {
      b.push(parseInt(h, 16));
      i += 2;
    } else b.push(...Buffer.from(soft[i], 'utf8'));
  }
  return Buffer.from(b).toString('utf8');
};
const decodeHeader = (h) => h.replace(/=\?UTF-8\?Q\?(.*?)\?=\s*/gi, (_, q) => decodeQP(q.replace(/_/g, ' ')));
async function mails(email) {
  const data = await (await fetch(`http://localhost:8028/api/v2/search?kind=to&query=${encodeURIComponent(email)}`)).json();
  return data.items.map((m) => ({ subject: decodeHeader(m.Content.Headers.Subject[0]), body: decodeQP(m.Content.Body) }));
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const fileForm = (field, name, content, type) => {
  const form = new FormData();
  form.append(field, new Blob([content], { type }), name);
  return form;
};

// ── Préparation ─────────────────────────────────────────────────────────
section('Préparation');
// Les chiffres de la marketplace sont globaux : on repart d'un portefeuille vide et des réglages par défaut.
sql('delete from wallet_entries; delete from withdrawals; delete from marketplace_settings;');
const adminToken = (await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: process.env.BS_ADMIN_PASSWORD } })).json.accessToken;
check('connexion admin', !!adminToken);
const categoryId = (await call('GET', '/categories')).json[0].id;

async function makeSeller(label, { verified = true } = {}) {
  const email = `${label}.${run}@test.local`;
  await call('POST', '/seller/auth/register', { body: { firstName: 'Paul', lastName: 'Ekane', email, phone: '677001122', password: 'vendeur2026', acceptTerms: true } });
  await wait(800);
  const token0 = (await mails(email)).map((m) => m.body.match(/token=([a-f0-9]{64})/)?.[1]).find(Boolean);
  await call('POST', '/seller/auth/verify-email', { body: { token: token0 } });
  const token = (await call('POST', '/seller/auth/login', { body: { email, password: 'vendeur2026' } })).json.accessToken;
  const id = (await call('GET', '/seller/me', { token })).json.id;
  await call('PATCH', `/admin/sellers/${id}/status`, { token: adminToken, body: { status: 'approved' } });
  await call('PUT', '/seller/store', { token, body: { name: `Paul ${label} ${run}`, slug: `paul-${label}-${run}` } });
  if (verified) {
    const form = new FormData();
    form.append('documentType', 'passport');
    form.append('fullName', 'Paul Ekane');
    form.append('consent', 'true');
    form.append('documentFront', new Blob([PNG], { type: 'image/png' }), 'p.png');
    form.append('selfie', new Blob([PNG], { type: 'image/png' }), 's.png');
    await call('POST', '/seller/identity', { token, form });
    const check0 = (await call('GET', '/admin/identity-checks', { token: adminToken })).json.find((c) => c.seller.email === email);
    await call('PATCH', `/admin/identity-checks/${check0.id}`, { token: adminToken, body: { decision: 'approve' } });
  }
  return { email, token, id };
}
async function publish(seller, name, price) {
  const p = (await call('POST', '/seller/products', {
    token: seller.token,
    body: { name, price, categoryId, description: 'Un produit payant pour tester le portefeuille du vendeur.' },
  })).json;
  await call('POST', `/seller/products/${p.id}/cover`, { token: seller.token, form: fileForm('file', 'c.png', PNG, 'image/png') });
  await call('POST', `/seller/products/${p.id}/file`, { token: seller.token, form: fileForm('file', 'f.pdf', '%PDF-1.4 x', 'application/pdf') });
  for (let i = 0; i < 40 && (await call('GET', `/seller/products/${p.id}`, { token: seller.token })).json.scanStatus !== 'clean'; i++) await wait(250);
  const s = (await call('POST', `/seller/products/${p.id}/submit`, { token: seller.token, body: { certifyRights: true } })).json;
  if (s.reviewStatus === 'pending') await call('PATCH', `/admin/products/${p.id}/review`, { token: adminToken, body: { decision: 'approve' } });
  return p;
}
/** Commande payée par le faux CinetPay : création, initiation, notification. */
async function buy(items, email = `client.${run}@test.local`) {
  const order = (await call('POST', '/orders', { body: { customerName: 'Client Test', customerEmail: email, customerPhone: '699000099', items, acceptTerms: true } })).json;
  if (order.status === 'paid') return order;
  await call('POST', '/payments/initiate', { body: { orderId: order.id } });
  const reference = sql(`select payment_reference from orders where id = '${order.id}'`);
  await call('POST', '/payments/notify', { body: { transaction_id: reference } });
  return { ...order, reference };
}

const paul = await makeSeller('paul');
const p1 = await publish(paul, `Guide premium ${run}`, 2500);
const p2 = await publish(paul, `Mini guide ${run}`, 1005);
const free = await publish(paul, `Guide gratuit ${run}`, 0);
check('vendeur validé, identité vérifiée, 3 produits en ligne', !!p1.id && !!p2.id && !!free.id);

section('Réglages');
let r = await call('GET', '/admin/wallet/settings', { token: adminToken });
check('réglages par défaut : 10 %, 7 jours, 5 000 FCFA', r.json.commissionRate === 10 && r.json.holdDays === 7 && r.json.minWithdrawal === 5000, r.json);
r = await call('PUT', '/admin/wallet/settings', { token: adminToken, body: { commissionRate: 60, holdDays: 7, minWithdrawal: 5000 } });
check('commission de 60 % refusée', r.status === 400, msg(r));
r = await call('GET', '/admin/wallet/settings', { token: paul.token });
check('réglages réservés à l’admin', r.status === 401, r.status);

section('Vente payée');
r = await call('GET', '/seller/wallet', { token: paul.token });
check('portefeuille vide au départ', r.json.balance.total === 0 && r.json.canWithdraw === false, r.json.balance);
const order1 = await buy([{ productId: p1.id, quantity: 2 }]);
r = await call('GET', `/orders/by-number/${order1.orderNumber}?email=${encodeURIComponent(`client.${run}@test.local`)}`);
check('commande payée par le faux CinetPay', r.json.status === 'paid', r.json.status);
r = await call('GET', '/seller/wallet', { token: paul.token });
check('2 ventes de 2 500 : 4 500 FCFA en attente (commission 500)', r.json.balance.pending === 4500 && r.json.balance.available === 0, r.json.balance);
check('statistiques de ventes', r.json.stats.salesCount === 2 && r.json.stats.grossSales === 5000 && r.json.stats.commissions === 500 && r.json.stats.netEarnings === 4500, r.json.stats);
check('prochain déblocage dans 7 jours', Math.abs(new Date(r.json.nextRelease.date) - Date.now() - 7 * 86400000) < 120000, r.json.nextRelease);
await call('POST', '/payments/notify', { body: { transaction_id: order1.reference } });
r = await call('GET', '/seller/wallet', { token: paul.token });
check('notification répétée : aucun double crédit', r.json.balance.pending === 4500, r.json.balance);
await wait(1000);
check('e-mail « Nouvelle vente » au vendeur', (await mails(paul.email)).some((m) => m.subject.startsWith('Nouvelle vente')));
r = await call('GET', '/seller/wallet/entries', { token: paul.token });
const sale = r.json.entries.find((e) => e.type === 'sale');
check('historique : vente détaillée (prix, commission, taux)', sale?.grossAmount === 2500 && sale?.commission === 250 && sale?.commissionRate === 10 && sale?.amount === 2250 && !sale?.available && sale?.productName === `Guide premium ${run}`, sale);

const freeOrder = await buy([{ productId: free.id, quantity: 1 }]);
r = await call('GET', '/seller/wallet', { token: paul.token });
check('produit gratuit : aucun crédit', freeOrder.status === 'paid' && r.json.balance.total === 4500, r.json.balance);

section('Délai de sécurité et retrait minimum');
r = await call('POST', '/seller/wallet/withdrawals', { token: paul.token, body: { amount: 4500, operator: 'orange', phone: '699112233', accountName: 'Paul Ekane' } });
check('retrait impossible pendant le délai', r.status === 400 && /solde retirable/.test(msg(r)), msg(r));
sql(`update wallet_entries set available_at = now() - interval '1 minute' where seller_id = '${paul.id}'`);
r = await call('GET', '/seller/wallet', { token: paul.token });
check('après 7 jours : 4 500 FCFA retirables', r.json.balance.available === 4500 && r.json.balance.pending === 0, r.json.balance);
check('sous le minimum de 5 000 : retrait bloqué', r.json.canWithdraw === false && /minimum/.test(r.json.blocker), r.json.blocker);
r = await call('PUT', '/admin/wallet/settings', { token: adminToken, body: { commissionRate: 10, holdDays: 7, minWithdrawal: 1000 } });
check('retrait minimum abaissé à 1 000 FCFA', r.status === 200 && r.json.minWithdrawal === 1000, r.json);

section('Demande de retrait');
const base = { operator: 'orange', phone: '6 99 11 22 33', accountName: 'Paul Ekane' };
r = await call('POST', '/seller/wallet/withdrawals', { token: paul.token, body: { ...base, amount: 4501 } });
check('montant non multiple de 5 : 400', r.status === 400, msg(r));
r = await call('POST', '/seller/wallet/withdrawals', { token: paul.token, body: { ...base, amount: 5000 } });
check('montant supérieur au solde : 400', r.status === 400 && /solde retirable/.test(msg(r)), msg(r));
r = await call('POST', '/seller/wallet/withdrawals', { token: paul.token, body: { ...base, amount: 500 } });
check('sous le minimum : 400', r.status === 400 && /minimum/.test(msg(r)), msg(r));
r = await call('POST', '/seller/wallet/withdrawals', { token: paul.token, body: { ...base, amount: 3000, phone: '+33612345678' } });
check('numéro non camerounais : 400', r.status === 400, msg(r));
r = await call('POST', '/seller/wallet/withdrawals', { token: paul.token, body: { ...base, amount: 3000, operator: 'wave' } });
check('opérateur inconnu : 400', r.status === 400, msg(r));

// Deux demandes simultanées de 3 000 sur 4 500 : une seule doit passer.
const [a, b] = await Promise.all([
  call('POST', '/seller/wallet/withdrawals', { token: paul.token, body: { ...base, amount: 3000 } }),
  call('POST', '/seller/wallet/withdrawals', { token: paul.token, body: { ...base, amount: 3000 } }),
]);
check('demandes simultanées : une seule acceptée', [a.status, b.status].sort().join() === '201,409', [a.status, b.status, msg(a), msg(b)]);
const w1 = a.status === 201 ? a.json : b.json;
check('numéro normalisé en +237…', w1.phone === '+237699112233' && w1.status === 'pending', w1);
r = await call('GET', '/seller/wallet', { token: paul.token });
check('solde après la demande : 1 500 retirables, retrait en cours', r.json.balance.available === 1500 && r.json.pendingWithdrawal?.id === w1.id, r.json.balance);

r = await call('POST', `/seller/wallet/withdrawals/${w1.id}/cancel`, { token: paul.token });
check('retrait annulé par le vendeur', r.status === 201 && r.json.status === 'cancelled', r.json);
r = await call('GET', '/seller/wallet', { token: paul.token });
check('montant restitué : 4 500 retirables', r.json.balance.available === 4500, r.json.balance);
r = await call('POST', `/seller/wallet/withdrawals/${w1.id}/cancel`, { token: paul.token });
check('double annulation : 409', r.status === 409, r.status);

section('Paiement par l’admin');
const w2 = (await call('POST', '/seller/wallet/withdrawals', { token: paul.token, body: { ...base, amount: 4000, operator: 'mtn', phone: '677445566' } })).json;
check('nouvelle demande de 4 000 vers MTN', w2.status === 'pending' && w2.operator === 'mtn', w2);
r = await call('GET', '/admin/wallet/withdrawals', { token: adminToken });
const queued = r.json.find((w) => w.id === w2.id);
check('dans la file « à payer », avec identité vérifiée et solde', queued?.seller.verifiedName === 'Paul Ekane' && queued?.sellerBalance.available === 500, queued);
r = await call('GET', '/admin/wallet/withdrawals', { token: paul.token });
check('file refusée à un vendeur', r.status === 401, r.status);
r = await call('PATCH', `/admin/wallet/withdrawals/${w2.id}`, { token: adminToken, body: { action: 'paid' } });
check('payé sans référence : 400', r.status === 400, msg(r));
r = await call('PATCH', `/admin/wallet/withdrawals/${w2.id}`, { token: adminToken, body: { action: 'paid', reference: 'MP261002.1530.B12345' } });
check('retrait marqué comme payé', r.status === 200 && r.json.status === 'paid' && r.json.transferReference === 'MP261002.1530.B12345', r.json);
r = await call('PATCH', `/admin/wallet/withdrawals/${w2.id}`, { token: adminToken, body: { action: 'reject', note: 'trop tard pour refuser' } });
check('déjà traité : 409', r.status === 409, r.status);
await wait(1000);
check('reçu envoyé par e-mail', (await mails(paul.email)).some((m) => /envoyé/.test(m.subject) && m.body.includes('MP261002.1530.B12345')));
r = await call('GET', `/seller/wallet/withdrawals/${w2.id}`, { token: paul.token });
check('reçu consultable par le vendeur', r.status === 200 && r.json.status === 'paid' && r.json.seller.lastName === 'Ekane', r.json);
const other = await makeSeller('autre');
r = await call('GET', `/seller/wallet/withdrawals/${w2.id}`, { token: other.token });
check('reçu d’un autre vendeur : 404', r.status === 404, r.status);
r = await call('GET', '/seller/wallet', { token: paul.token });
check('solde 500, déjà retiré 4 000', r.json.balance.available === 500 && r.json.stats.withdrawn === 4000, [r.json.balance, r.json.stats]);

section('Refus par l’admin');
const order2 = await buy([{ productId: p2.id, quantity: 1 }]);
sql(`update wallet_entries set available_at = now() - interval '1 minute' where seller_id = '${paul.id}'`);
r = await call('GET', '/seller/wallet', { token: paul.token });
check('vente de 1 005 : commission arrondie à 101, 904 crédités', r.json.balance.available === 500 + 904, r.json.balance);
const w3 = (await call('POST', '/seller/wallet/withdrawals', { token: paul.token, body: { ...base, amount: 1400 } })).json;
r = await call('PATCH', `/admin/wallet/withdrawals/${w3.id}`, { token: adminToken, body: { action: 'reject', note: 'non' } });
check('refus sans motif suffisant : 400', r.status === 400, msg(r));
r = await call('PATCH', `/admin/wallet/withdrawals/${w3.id}`, { token: adminToken, body: { action: 'reject', note: 'Le numéro n’est pas au nom du vendeur.' } });
check('retrait refusé', r.status === 200 && r.json.status === 'rejected', r.json);
r = await call('GET', '/seller/wallet', { token: paul.token });
check('montant restitué après refus', r.json.balance.available === 1404, r.json.balance);
await wait(1000);
check('e-mail « retrait refusé » avec le motif', (await mails(paul.email)).some((m) => /refusé/.test(m.subject) && m.body.includes('au nom du vendeur')));

section('Remboursement d’une commande');
r = await call('PATCH', `/orders/${order2.id}/refund`, { token: adminToken });
check('commande remboursée', r.status === 200 && r.json.status === 'refunded', r.json);
r = await call('GET', '/seller/wallet', { token: paul.token });
check('vente annulée chez le vendeur (−904)', r.json.balance.available === 500 && r.json.stats.salesCount === 3 - 1, [r.json.balance, r.json.stats]);
r = await call('PATCH', `/orders/${order2.id}/refund`, { token: adminToken });
check('second remboursement refusé', r.status === 409, r.status);
r = await call('GET', '/seller/wallet/entries', { token: paul.token });
check('historique : remboursement détaillé', r.json.entries.some((e) => e.type === 'refund' && e.amount === -904 && e.commission === -101), r.json.entries.map((e) => [e.type, e.amount]));

section('Changement de commission');
await call('PUT', '/admin/wallet/settings', { token: adminToken, body: { commissionRate: 15, holdDays: 3, minWithdrawal: 5000 } });
await buy([{ productId: p1.id, quantity: 1 }], `client2.${run}@test.local`);
r = await call('GET', '/seller/wallet/entries', { token: paul.token });
const newest = r.json.entries.find((e) => e.type === 'sale');
check('nouvelle vente à 15 % et 3 jours', newest.commissionRate === 15 && newest.commission === 375 && newest.amount === 2125 && Math.abs(new Date(newest.availableAt) - Date.now() - 3 * 86400000) < 120000, newest);
check('anciennes ventes gardent 10 %', r.json.entries.filter((e) => e.type === 'sale' && e.id !== newest.id).every((e) => e.commissionRate === 10));

section('Conditions du retrait');
const unverified = await makeSeller('nonverifie', { verified: false });
const p3 = await publish(unverified, `Produit sans identité ${run}`, 10000);
await buy([{ productId: p3.id, quantity: 1 }], `client3.${run}@test.local`);
sql(`update wallet_entries set available_at = now() - interval '1 minute' where seller_id = '${unverified.id}'`);
r = await call('GET', '/seller/wallet', { token: unverified.token });
check('identité non vérifiée : retrait bloqué', r.json.balance.available === 8500 && r.json.canWithdraw === false && /identité/.test(r.json.blocker), [r.json.balance, r.json.blocker]);
r = await call('POST', '/seller/wallet/withdrawals', { token: unverified.token, body: { ...base, amount: 8000 } });
check('demande refusée sans identité vérifiée : 403', r.status === 403, msg(r));

section('Chiffres de l’admin');
r = await call('GET', '/admin/wallet/summary', { token: adminToken });
// Ventes : 2×2500 + 1005 − 1005 (remboursée) + 2500 + 10000 = 17 500 ; commissions : 500 + 101 − 101 + 375 + 1500 = 2 375.
check('ventes et commissions de la marketplace', r.json.grossSales === 17500 && r.json.commissions === 2375, r.json);
check('déjà versé : 4 000', r.json.paidOut === 4000, r.json);
const balances = Number(sql(`select coalesce(sum(amount), 0) from wallet_entries`));
check('soldes des vendeurs = somme des mouvements', r.json.sellerBalances === balances, [r.json.sellerBalances, balances]);

console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko > 0 ? 1 : 0);
