// Essais de bout en bout des litiges (demandes de remboursement) contre l'API de test (port 3100), avec le
// faux CinetPay (port 3998) : commande retrouvée, demande, argent bloqué, réponse du vendeur, décision,
// remboursement d'un seul article, envoi de l'argent, e-mails, pages de la boutique.
// Usage : BS_ADMIN_PASSWORD=… BS_PG_PASS=… [STOREFRONT=http://localhost:3001] node e2e-disputes.mjs
import { execSync } from 'child_process';

const API = 'http://localhost:3100';
const STOREFRONT = process.env.STOREFRONT ?? 'http://localhost:3001';
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

async function call(method, path, { body, token, form, ip = '10.71.0.1', redirect } = {}) {
  const headers = { 'X-Real-IP': ip };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined), redirect });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, text };
}
const msg = (r) => (Array.isArray(r.json?.message) ? r.json.message.join(' | ') : r.json?.message);
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
  // Les montants s'écrivent avec une espace fine insécable (« 3 000 ») : ramenée à une espace simple.
  return data.items.map((m) => ({
    subject: decodeHeader(m.Content.Headers.Subject[0]),
    body: decodeQP(m.Content.Body).replace(/&#39;/g, "'").replace(/[  ]/g, ' '),
  }));
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const fileForm = (field, name, content, type) => {
  const form = new FormData();
  form.append(field, new Blob([content], { type }), name);
  return form;
};

// ── Préparation ─────────────────────────────────────────────────────────
section('Préparation');
sql('delete from disputes; delete from wallet_entries; delete from withdrawals; delete from marketplace_settings;');
const adminToken = (await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: process.env.BS_ADMIN_PASSWORD } })).json.accessToken;
check('connexion admin', !!adminToken);
const categoryId = (await call('GET', '/categories')).json[0].id;

async function makeSeller(label) {
  const email = `${label}.${run}@test.local`;
  await call('POST', '/seller/auth/register', { body: { firstName: 'Awa', lastName: 'Ngono', email, phone: '677001133', password: 'vendeur2026', acceptTerms: true } });
  await wait(800);
  const token0 = (await mails(email)).map((m) => m.body.match(/token=([a-f0-9]{64})/)?.[1]).find(Boolean);
  await call('POST', '/seller/auth/verify-email', { body: { token: token0 } });
  const token = (await call('POST', '/seller/auth/login', { body: { email, password: 'vendeur2026' } })).json.accessToken;
  const id = (await call('GET', '/seller/me', { token })).json.id;
  await call('PATCH', `/admin/sellers/${id}/status`, { token: adminToken, body: { status: 'approved' } });
  await call('PUT', '/seller/store', { token, body: { name: `Awa ${label} ${run}`, slug: `awa-${label}-${run}` } });
  return { email, token, id };
}
async function publish(seller, name, price) {
  const p = (await call('POST', '/seller/products', {
    token: seller.token,
    body: { name, price, categoryId, description: 'Un produit payant pour tester les litiges et les remboursements.' },
  })).json;
  await call('POST', `/seller/products/${p.id}/cover`, { token: seller.token, form: fileForm('file', 'c.png', PNG, 'image/png') });
  await call('POST', `/seller/products/${p.id}/file`, { token: seller.token, form: fileForm('file', 'f.pdf', '%PDF-1.4 x', 'application/pdf') });
  for (let i = 0; i < 40 && (await call('GET', `/seller/products/${p.id}`, { token: seller.token })).json.scanStatus !== 'clean'; i++) await wait(250);
  const s = (await call('POST', `/seller/products/${p.id}/submit`, { token: seller.token, body: { certifyRights: true } })).json;
  if (s.reviewStatus === 'pending') await call('PATCH', `/admin/products/${p.id}/review`, { token: adminToken, body: { decision: 'approve' } });
  return p;
}
const buyer = `acheteur.${run}@test.local`;
/** Commande payée par le faux CinetPay : création, initiation, notification. */
async function buy(items, email = buyer, { pay = true } = {}) {
  const order = (await call('POST', '/orders', { body: { customerName: 'Client Testeur', customerEmail: email, customerPhone: '699000099', items, acceptTerms: true } })).json;
  if (order.status === 'paid' || !pay) return order;
  await call('POST', '/payments/initiate', { body: { orderId: order.id } });
  const reference = sql(`select payment_reference from orders where id = '${order.id}'`);
  await call('POST', '/payments/notify', { body: { transaction_id: reference } });
  return order;
}
const itemsOf = (orderId) => sql(`select id from order_items where order_id = '${orderId}' order by created_at, id`).split('\n').filter(Boolean);
const tokenOf = (itemId) => sql(`select token from download_tokens where order_item_id = '${itemId}'`);
const refund = { refundOperator: 'mtn', refundPhone: '6 77 12 34 56', refundAccountName: 'Client Testeur' };
const describe = 'Le fichier PDF est vide : il ne s’ouvre sur aucun de mes appareils.';

const awa = await makeSeller('awa');
const other = await makeSeller('autre');
const p1 = await publish(awa, `Formation vidéo ${run}`, 3000);
const p2 = await publish(awa, `Modèles Canva ${run}`, 1500);
const free = await publish(awa, `Guide gratuit ${run}`, 0);
const bs = (await call('POST', '/products', { token: adminToken, body: { name: `Logiciel BlackStore ${run}`, description: 'Produit vendu par BlackStore.', price: 2000, categoryId } })).json;
await call('POST', `/products/${bs.id}/upload`, { token: adminToken, form: fileForm('file', 'setup.zip', 'PK-zip', 'application/zip') });
await call('PATCH', `/products/${bs.id}`, { token: adminToken, body: { isActive: true } });
check('vendeurs, produits payants, gratuit et produit BlackStore prêts', !!p1.id && !!p2.id && !!free.id && !!bs.id);

const orderA = await buy([{ productId: p1.id, quantity: 1 }]);
const orderB = await buy([{ productId: p1.id, quantity: 1 }, { productId: p2.id, quantity: 1 }]);
const orderC = await buy([{ productId: free.id, quantity: 1 }]);
const orderD = await buy([{ productId: bs.id, quantity: 1 }]);
const orderE = await buy([{ productId: p2.id, quantity: 1 }]);
const orderF = await buy([{ productId: p2.id, quantity: 1 }]);
const unpaid = await buy([{ productId: p2.id, quantity: 1 }], buyer, { pay: false });
const status = (o) => sql(`select status from orders where id = '${o.id}'`);
check('commandes payées par le faux CinetPay', [orderA, orderB, orderD, orderE, orderF].every((o) => status(o) === 'paid') && status(orderC) === 'paid', [orderA, orderB, orderD].map(status));
const [itemA] = itemsOf(orderA.id);
const [itemB1, itemB2] = itemsOf(orderB.id);
const [itemC] = itemsOf(orderC.id);
const [itemD] = itemsOf(orderD.id);
const [itemE] = itemsOf(orderE.id);
const [itemF] = itemsOf(orderF.id);

// ── Retrouver sa commande ──────────────────────────────────────────────
section('Retrouver sa commande');
let r = await call('POST', '/disputes/commande', { body: { orderNumber: orderA.orderNumber, email: 'quelquun@autre.cm' } });
check('mauvais e-mail : commande introuvable (404 en français)', r.status === 404 && /^Commande introuvable/.test(msg(r)), [r.status, msg(r)]);
r = await call('POST', '/disputes/commande', { body: { orderNumber: '12345', email: buyer } });
check('numéro mal formé refusé', r.status === 400 && /Numéro de commande invalide/.test(msg(r)), msg(r));
r = await call('POST', '/disputes/commande', { body: { orderNumber: orderA.orderNumber.toLowerCase(), email: buyer.toUpperCase() } });
check('commande retrouvée (majuscules et minuscules indifférentes)', r.status === 200 && r.json.items.length === 1 && r.json.open === true && r.json.items[0].blocker === null, r.json);
check('aucune donnée personnelle renvoyée', !r.text.includes(buyer) && !r.text.includes('699000099'));
r = await call('POST', '/disputes/commande', { body: { orderNumber: orderC.orderNumber, email: buyer } });
check('produit gratuit signalé comme non remboursable', /gratuit/.test(r.json.items?.[0]?.blocker ?? ''), r.json);
r = await call('POST', '/disputes/commande', { body: { orderNumber: unpaid.orderNumber, email: buyer } });
check('commande non payée : rien à rembourser (409)', r.status === 409 && /pas été payée/.test(msg(r)), [r.status, msg(r)]);

// ── Demande de remboursement ───────────────────────────────────────────
section('Demande de remboursement');
// 5 demandes par heure et par adresse : chaque essai prend sa propre adresse.
let askCount = 0;
const ask = (orderNumber, orderItemId, extra = {}) => {
  const { ip, ...fields } = extra;
  return call('POST', '/disputes', {
    body: { orderNumber, email: buyer, orderItemId, reason: 'unusable', description: describe, ...refund, ...fields },
    ip: ip ?? `10.71.1.${++askCount}`,
  });
};
r = await ask(orderA.orderNumber, itemA, { description: 'Trop court' });
check('description trop courte refusée en français', r.status === 400 && /20 caractères/.test(msg(r)), msg(r));
r = await ask(orderA.orderNumber, itemA, { refundPhone: '+33 6 12 34 56 78' });
check('numéro Mobile Money étranger refusé', r.status === 400 && /camerounais/.test(msg(r)), msg(r));
r = await ask(orderC.orderNumber, itemC);
check('produit gratuit : demande refusée', r.status === 400 && /gratuit/.test(msg(r)), msg(r));
r = await ask(orderA.orderNumber, itemB1);
check('produit d’une autre commande refusé', r.status === 404, [r.status, msg(r)]);
r = await ask(orderA.orderNumber, itemA, { website: 'http://spam.example' });
check('robot (champ piège) : réponse normale, rien enregistré', r.status === 201 && r.json.reference === null && sql(`select count(*) from disputes where order_item_id = '${itemA}'`) === '0', r.json);
r = await ask(orderA.orderNumber, itemA);
const refA = r.json.reference;
check('demande enregistrée avec une référence LIT-', r.status === 201 && /^LIT-\d{4}-\d{5}$/.test(refA ?? '') && r.json.withSeller === true, [r.status, r.json]);
const savedA = sql(`select refund_phone || '|' || status || '|' || round(extract(epoch from seller_deadline - created_at) / 60) from disputes where reference = '${refA}'`);
check('numéro normalisé, vendeur prévenu, 5 jours pour répondre', savedA === `+237677123456|open|${5 * 24 * 60}`, savedA);
r = await ask(orderA.orderNumber, itemA);
check('deuxième demande pour le même produit refusée', r.status === 409 && msg(r).includes(refA), [r.status, msg(r)]);
r = await call('POST', '/disputes/commande', { body: { orderNumber: orderA.orderNumber, email: buyer } });
check('la commande indique la demande en cours', r.json.items[0].dispute?.reference === refA && r.json.items[0].blocker?.includes(refA), r.json.items[0]);
await wait(1200);
let buyerMails = await mails(buyer);
check('accusé de réception envoyé au client avec la référence', buyerMails.some((m) => m.subject.includes(refA) && m.body.includes('5 jours')), buyerMails.map((m) => m.subject));
let sellerMails = await mails(awa.email);
const openedMail = sellerMails.find((m) => m.subject.includes(refA));
check('vendeur prévenu : motif, message, délai et lien', !!openedMail && openedMail.body.includes('Produit inutilisable') && openedMail.body.includes('PDF est vide') && openedMail.body.includes('/vendeur/litiges'), sellerMails.map((m) => m.subject));
check('le vendeur ne reçoit ni l’e-mail ni le numéro du client', !!openedMail && !openedMail.body.includes(buyer) && !openedMail.body.includes('677123456'));

sql(`update orders set paid_at = now() - interval '8 days' where id = '${orderE.id}'`);
r = await ask(orderE.orderNumber, itemE);
check('après 7 jours : délai dépassé', r.status === 400 && /délai est dépassé/.test(msg(r)), msg(r));
r = await call('POST', '/disputes/commande', { body: { orderNumber: orderE.orderNumber, email: buyer } });
check('après 7 jours : seul le double paiement reste possible', r.json.open === false && r.json.openForDoublePayment === true, r.json);
r = await ask(orderE.orderNumber, itemE, { reason: 'double_payment', description: 'J’ai été débité deux fois pour la même commande.' });
check('double paiement accepté jusqu’à 30 jours', r.status === 201, [r.status, msg(r)]);
const refE = r.json.reference;

// ── Argent bloqué chez le vendeur ──────────────────────────────────────
section('Argent bloqué chez le vendeur');
r = await call('GET', '/seller/wallet', { token: awa.token });
// Ventes : A 3 000, B 3 000 + 1 500, E 1 500, F 1 500 (commission 10 %) ; A et E en litige.
check('ventes en litige bloquées, le reste en attente', r.json.balance.blocked === 2700 + 1350 && r.json.balance.pending === 2700 + 1350 + 1350 && r.json.openDisputes === 2, r.json.balance);
sql(`update wallet_entries set available_at = now() - interval '1 day' where seller_id = '${awa.id}'`);
r = await call('GET', '/seller/wallet', { token: awa.token });
check('délai passé : le litige reste bloqué, le reste devient retirable', r.json.balance.available === 5400 && r.json.balance.blocked === 4050 && r.json.balance.withdrawable === 5400, r.json.balance);
r = await call('GET', '/seller/wallet/entries', { token: awa.token });
check('historique : la vente en litige est marquée', r.json.entries.filter((e) => e.dispute).length === 2, r.json.entries.map((e) => e.dispute));

// ── Réponse du vendeur ─────────────────────────────────────────────────
section('Réponse du vendeur');
r = await call('GET', '/seller/disputes', { token: awa.token });
const dA = r.json.find((d) => d.reference === refA);
check('le vendeur voit le litige, avec le prénom du client seulement', !!dA && dA.buyerName === 'Client T.' && dA.canRespond === true && dA.sellerAmount === 2700, dA);
check('ni e-mail ni numéro du client chez le vendeur', !r.text.includes(buyer) && !r.text.includes('677123456') && !r.text.includes('699000099'));
r = await call('GET', '/seller/disputes', { token: other.token });
check('un autre vendeur ne voit rien', Array.isArray(r.json) && r.json.length === 0, r.json);
r = await call('POST', `/seller/disputes/${dA.id}/respond`, { token: other.token, body: { message: 'Je ne suis pas concerné du tout.', acceptRefund: true } });
check('un autre vendeur ne peut pas répondre (404)', r.status === 404, r.status);
r = await call('POST', `/seller/disputes/${dA.id}/respond`, { token: awa.token, body: { message: 'Court', acceptRefund: false } });
check('réponse trop courte refusée', r.status === 400, msg(r));
r = await call('POST', `/seller/disputes/${dA.id}/respond`, { token: awa.token, body: { message: 'Le fichier a été remplacé ce matin, il s’ouvre maintenant.', acceptRefund: 'true' } });
check('réponse enregistrée ; « true » en texte ne vaut pas accord', r.status === 200 && r.json.status === 'review' && r.json.sellerAcceptsRefund === false && r.json.canRespond === false, r.json);
r = await call('POST', `/seller/disputes/${dA.id}/respond`, { token: awa.token, body: { message: 'Finalement j’accepte de rembourser.', acceptRefund: true } });
check('une seule réponse possible (409)', r.status === 409, [r.status, msg(r)]);

// ── Administration ──────────────────────────────────────────────────────
section('Administration');
r = await call('GET', '/admin/disputes', { token: awa.token });
check('liste réservée à l’admin', r.status === 401, r.status);
r = await call('GET', '/admin/disputes', { token: adminToken });
check('« À traiter » : la demande avec réponse du vendeur', r.json.some((d) => d.reference === refA) && !r.json.some((d) => d.reference === refE), r.json.map((d) => d.reference));
const aA = r.json.find((d) => d.reference === refA);
check('l’admin voit le client et le compte de remboursement', aA.buyer.email === buyer && aA.refund.phone === '+237677123456' && aA.refund.operatorLabel === 'MTN Mobile Money', aA.refund);
r = await call('GET', '/admin/disputes?filter=waiting', { token: adminToken });
check('« En attente du vendeur » : la demande encore dans le délai', r.json.some((d) => d.reference === refE), r.json.map((d) => d.reference));
sql(`update disputes set seller_deadline = now() - interval '1 hour' where reference = '${refE}'`);
r = await call('GET', '/admin/disputes', { token: adminToken });
check('délai du vendeur dépassé : la demande passe « à traiter »', r.json.find((d) => d.reference === refE)?.late === true, r.json.map((d) => [d.reference, d.late]));
const idE = r.json.find((d) => d.reference === refE).id;

r = await call('PATCH', `/admin/disputes/${idE}`, { token: adminToken, body: { action: 'reject' } });
check('refus sans motif impossible', r.status === 400 && /motif/.test(msg(r)), msg(r));
r = await call('PATCH', `/admin/disputes/${idE}`, { token: adminToken, body: { action: 'reject', note: 'Un seul paiement apparaît chez l’opérateur pour cette commande.' } });
check('demande refusée avec motif', r.status === 200 && r.json.status === 'rejected', [r.status, r.json?.status]);
r = await call('PATCH', `/admin/disputes/${idE}`, { token: adminToken, body: { action: 'accept' } });
check('litige tranché : plus de décision possible', r.status === 409, r.status);
r = await call('GET', '/seller/wallet', { token: awa.token });
check('refus : la vente est débloquée', r.json.balance.blocked === 2700 && r.json.balance.available === 5400 + 1350, r.json.balance);

const tokenA = tokenOf(itemA);
r = await call('PATCH', `/admin/disputes/${aA.id}`, { token: adminToken, body: { action: 'refunded', reference: 'MP-123' } });
check('« argent envoyé » impossible avant d’avoir accordé le remboursement', r.status === 409, r.status);
r = await call('PATCH', `/admin/disputes/${aA.id}`, { token: adminToken, body: { action: 'accept', note: 'Le fichier livré était vide.' } });
check('remboursement accordé', r.status === 200 && r.json.status === 'accepted', [r.status, r.json?.status, msg(r)]);
check('commande d’un seul article : « remboursée »', status(orderA) === 'refunded', status(orderA));
r = await call('GET', `/downloads/${tokenA}/etat`);
check('lien de téléchargement coupé', r.json.etat === 'annule', r.json);
r = await call('GET', '/seller/wallet', { token: awa.token });
check('vente retirée du solde du vendeur, plus rien de bloqué', r.json.balance.blocked === 0 && r.json.balance.available === 5400 + 1350 && r.json.openDisputes === 0, r.json.balance);
r = await call('PATCH', `/admin/disputes/${aA.id}`, { token: adminToken, body: { action: 'refunded' } });
check('envoi sans référence refusé', r.status === 400 && /référence/.test(msg(r)), msg(r));
r = await call('PATCH', `/admin/disputes/${aA.id}`, { token: adminToken, body: { action: 'refunded', reference: 'MP261005.1234.B98765' } });
check('argent envoyé : litige clos avec la référence', r.status === 200 && r.json.status === 'refunded' && r.json.refund.reference === 'MP261005.1234.B98765', r.json);
r = await call('GET', '/admin/disputes?filter=closed', { token: adminToken });
check('« Clos » : remboursé et refusé', [refA, refE].every((ref) => r.json.some((d) => d.reference === ref)), r.json.map((d) => d.reference));

await wait(1200);
buyerMails = await mails(buyer);
const accepted = buyerMails.find((m) => m.subject.includes('Remboursement accordé') && m.subject.includes(refA));
check('client : remboursement accordé, montant et compte masqué', !!accepted && accepted.body.includes('3 000') && accepted.body.includes('+2376•••••456') && !accepted.body.includes('677123456'), buyerMails.map((m) => m.subject));
check('client : refus avec le motif', buyerMails.some((m) => m.subject.includes(refE) && m.subject.includes('refusée') && m.body.includes('Un seul paiement')));
check('client : reçu avec la référence de l’envoi', buyerMails.some((m) => m.subject.includes('Remboursement envoyé') && m.body.includes('MP261005.1234.B98765')));
sellerMails = await mails(awa.email);
check('vendeur : issue des deux litiges', sellerMails.some((m) => m.subject.includes(refA) && m.subject.includes('remboursé')) && sellerMails.some((m) => m.subject.includes(refE) && m.subject.includes('sans remboursement')), sellerMails.map((m) => m.subject));

section('Remboursement d’un seul article d’une commande');
r = await ask(orderB.orderNumber, itemB1, { ip: '10.71.2.2' });
const refB1 = r.json.reference;
const idB1 = (await call('GET', '/admin/disputes?filter=waiting', { token: adminToken })).json.find((d) => d.reference === refB1)?.id;
r = await call('PATCH', `/admin/disputes/${idB1}`, { token: adminToken, body: { action: 'accept' } });
check('article remboursé sans réponse du vendeur (décision possible à tout moment)', r.status === 200 && r.json.status === 'accepted', [r.status, msg(r)]);
check('la commande reste payée (l’autre article est gardé)', status(orderB) === 'paid', status(orderB));
check('lien de l’article remboursé coupé, l’autre intact', (await call('GET', `/downloads/${tokenOf(itemB1)}/etat`)).json.etat === 'annule' && (await call('GET', `/downloads/${tokenOf(itemB2)}/etat`)).json.etat === 'valide');
r = await call('POST', `/orders/${orderB.id}/resend-download`, { token: adminToken });
await wait(1200);
const resent = (await mails(buyer)).find((m) => m.subject.includes('liens de téléchargement') && m.body.includes(tokenOf(itemB2)));
check('« Renvoyer les liens » : seulement l’article gardé', (r.status === 200 || r.status === 201) && !!resent && !resent.body.includes(tokenOf(itemB1)), [r.status, !!resent]);

section('Produit vendu par BlackStore');
r = await ask(orderD.orderNumber, itemD, { ip: '10.71.3.3', reason: 'not_as_described', description: 'Le logiciel est en anglais alors que la fiche le dit en français.' });
const refD = r.json.reference;
check('produit BlackStore : le client sait que BlackStore décide seul', r.json.withSeller === false, r.json);
check('pas de vendeur : directement à la décision de l’admin', sql(`select status || '|' || coalesce(seller_deadline::text, 'aucun') from disputes where reference = '${refD}'`) === 'review|aucun');
r = await call('GET', '/admin/disputes', { token: adminToken });
check('dans « À traiter », sans vendeur', r.json.find((d) => d.reference === refD)?.seller === null, r.json.find((d) => d.reference === refD));

section('Remboursement depuis la page Commandes');
r = await ask(orderF.orderNumber, itemF, { ip: '10.71.4.4' });
const refF = r.json.reference;
r = await call('PATCH', `/orders/${orderF.id}/refund`, { token: adminToken });
check('commande remboursée depuis « Commandes »', r.status === 200 && r.json.status === 'refunded', [r.status, msg(r)]);
check('le litige passe « remboursement accordé » (argent à envoyer)', sql(`select status from disputes where reference = '${refF}'`) === 'accepted');

// ── Pages de la boutique ───────────────────────────────────────────────
section('Pages de la boutique');
let storefrontUp = false;
try {
  storefrontUp = (await fetch(STOREFRONT, { redirect: 'manual' })).status < 500;
} catch {
  storefrontUp = false;
}
const html = async (path) => {
  const res = await fetch(STOREFRONT + path, { redirect: 'manual' });
  return { status: res.status, text: (await res.text()).replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&') };
};
if (!storefrontUp) {
  check(`boutique joignable sur ${STOREFRONT}`, false, 'lancer « next start -p 3001 »');
} else {
  let p = await html(`/remboursements/demande?commande=${orderB.orderNumber}`);
  check('formulaire de remboursement, numéro de commande prérempli', p.status === 200 && p.text.includes('Demander un remboursement') && p.text.includes(`value="${orderB.orderNumber}"`), p.status);
  p = await html('/remboursements');
  check('politique : lien vers le formulaire, version du 9 octobre', p.text.includes('href="/remboursements/demande"') && p.text.includes('9 octobre 2026'));
  p = await html('/conditions-vendeurs');
  check('conditions vendeurs : argent bloqué pendant un litige', p.text.includes('Pendant le litige, le montant de cette vente reste bloqué'));
  p = await html('/confidentialite');
  check('confidentialité : données des demandes de remboursement', p.text.includes('Demandes de remboursement'));
  p = await html(`/telechargement/${tokenOf(itemB2)}`);
  check('page de téléchargement : lien vers la demande de remboursement', p.text.includes(`/remboursements/demande?commande=${orderB.orderNumber}`));
}

console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko ? 1 : 0);
