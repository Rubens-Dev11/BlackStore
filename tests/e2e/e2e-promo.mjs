// Essais de bout en bout des codes promo contre l'API de test (port 3100), avec le faux CinetPay (port 3998) :
// gestion par le vendeur et l'admin, aperçu sur le panier, commande payée, gains du vendeur, limites
// d'utilisation (dont commandes simultanées), une fois par client, expiration, montant minimum, pages légales.
// Usage : BS_ADMIN_PASSWORD=… BS_PG_PASS=… [STOREFRONT=http://localhost:3001] node e2e-promo.mjs
import { execSync } from 'child_process';

const API = 'http://localhost:3100';
const STOREFRONT = process.env.STOREFRONT ?? 'http://localhost:3001';
const run = Date.now().toString(36);
const RUN = run.toUpperCase();
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
let ipCount = 0;
async function call(method, path, { body, token, form, ip } = {}) {
  const headers = { 'X-Real-IP': ip ?? `10.91.${Math.floor(ipCount / 250)}.${(ipCount++ % 250) + 1}` };
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
    body: decodeQP(m.Content.Body).replace(/&#39;/g, "'").replace(/[  ]/g, ' '),
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
sql('delete from marketplace_settings;');
const adminToken = (await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: process.env.BS_ADMIN_PASSWORD } })).json.accessToken;
check('connexion admin', !!adminToken);
const categoryId = (await call('GET', '/categories')).json[0].id;

async function registerSeller(label) {
  const email = `${label}.${run}@test.local`;
  await call('POST', '/seller/auth/register', { body: { firstName: 'Awa', lastName: 'Ngono', email, phone: '677001133', password: 'vendeur2026', acceptTerms: true }, ip: '10.90.0.1' });
  await wait(800);
  const token0 = (await mails(email)).map((m) => m.body.match(/token=([a-f0-9]{64})/)?.[1]).find(Boolean);
  await call('POST', '/seller/auth/verify-email', { body: { token: token0 } });
  const token = (await call('POST', '/seller/auth/login', { body: { email, password: 'vendeur2026' } })).json.accessToken;
  const id = (await call('GET', '/seller/me', { token })).json.id;
  await call('PATCH', `/admin/sellers/${id}/status`, { token: adminToken, body: { status: 'approved' } });
  return { email, token, id };
}
async function makeSeller(label) {
  const seller = await registerSeller(label);
  seller.storeName = `Boutique ${label} ${run}`;
  await call('PUT', '/seller/store', { token: seller.token, body: { name: seller.storeName, slug: `promo-${label}-${run}` } });
  return seller;
}
async function publish(seller, name, price) {
  const p = (await call('POST', '/seller/products', {
    token: seller.token,
    body: { name, price, categoryId, description: 'Un produit pour tester les codes promo et leurs réductions.' },
  })).json;
  await call('POST', `/seller/products/${p.id}/cover`, { token: seller.token, form: fileForm('file', 'c.png', PNG, 'image/png') });
  await call('POST', `/seller/products/${p.id}/file`, { token: seller.token, form: fileForm('file', 'f.pdf', '%PDF-1.4 x', 'application/pdf') });
  for (let i = 0; i < 40 && (await call('GET', `/seller/products/${p.id}`, { token: seller.token })).json.scanStatus !== 'clean'; i++) await wait(250);
  const s = (await call('POST', `/seller/products/${p.id}/submit`, { token: seller.token, body: { certifyRights: true } })).json;
  if (s.reviewStatus === 'pending') await call('PATCH', `/admin/products/${p.id}/review`, { token: adminToken, body: { decision: 'approve' } });
  return p;
}
/** Commande, payée par le faux CinetPay sauf `pay: false`. */
async function order(items, { email = `client.${run}@test.local`, promoCode, pay = true } = {}) {
  const r = await call('POST', '/orders', { body: { customerName: 'Client Promo', customerEmail: email, customerPhone: '699000099', items, acceptTerms: true, promoCode } });
  if (r.status !== 201 || r.json.status === 'paid' || !pay) return r;
  await call('POST', '/payments/initiate', { body: { orderId: r.json.id } });
  const reference = sql(`select payment_reference from orders where id = '${r.json.id}'`);
  await call('POST', '/payments/notify', { body: { transaction_id: reference } });
  return r;
}
const apply = (code, items, email) => call('POST', '/promo-codes/apply', { body: { code, items, email } });
const one = (p, quantity = 1) => ({ productId: p.id, quantity });
const statusOf = (id) => sql(`select status from orders where id = '${id}'`);

const awa = await makeSeller('awa');
const autre = await makeSeller('autre');
const p1 = await publish(awa, `Formation ${run}`, 3000);
const p2 = await publish(awa, `Modèles ${run}`, 1500);
const p3 = await publish(awa, `Fiche ${run}`, 150);
const free = await publish(awa, `Guide gratuit ${run}`, 0);
const q1 = await publish(autre, `Logo ${run}`, 2000);
const bs = (await call('POST', '/products', { token: adminToken, body: { name: `Logiciel BlackStore promo ${run}`, description: 'Produit vendu par BlackStore.', price: 2000, categoryId } })).json;
await call('POST', `/products/${bs.id}/upload`, { token: adminToken, form: fileForm('file', 'setup.zip', 'PK-zip', 'application/zip') });
await call('PATCH', `/products/${bs.id}`, { token: adminToken, body: { isActive: true } });
check('deux vendeurs, leurs produits et un produit BlackStore', [p1, p2, p3, free, q1, bs].every((p) => !!p.id));

// ── Gestion des codes ───────────────────────────────────────────────────
section('Gestion par le vendeur et l’admin');
let r = await call('GET', '/seller/promo-codes', { token: awa.token });
check('liste vide, boutique reconnue', r.status === 200 && r.json.hasStore === true && r.json.owner === awa.storeName && r.json.codes.length === 0, r.json);
const sansBoutique = await registerSeller('sansboutique');
r = await call('GET', '/seller/promo-codes', { token: sansBoutique.token });
check('vendeur sans boutique : hasStore false', r.status === 200 && r.json.hasStore === false, r.json);
r = await call('POST', '/seller/promo-codes', { token: sansBoutique.token, body: { code: `SANS${RUN}`, discountType: 'percent', value: 10 } });
check('vendeur sans boutique : création refusée (409)', r.status === 409 && /Créez d’abord votre boutique/.test(msg(r)), msg(r));
r = await call('GET', '/seller/promo-codes');
check('sans connexion : 401', r.status === 401, r.status);

const create = (seller, body) => call('POST', seller ? '/seller/promo-codes' : '/admin/promo-codes', { token: seller ? seller.token : adminToken, body });
const invalid = [
  [{ code: 'ab', discountType: 'percent', value: 10 }, /3 à 30 caractères/, 'code trop court'],
  [{ code: 'NOËL', discountType: 'percent', value: 10 }, /sans accent/, 'code accentué'],
  [{ code: `P${RUN}`, discountType: 'percent', value: 150 }, /1 à 100 %/, 'pourcentage > 100'],
  [{ code: `P${RUN}`, discountType: 'amount', value: 12 }, /multiple de 5/, 'montant non multiple de 5'],
  [{ code: `P${RUN}`, discountType: 'gratuit', value: 10 }, /pourcentage ou en montant/, 'type inconnu'],
  [{ code: `P${RUN}`, discountType: 'percent', value: 10, expiresAt: '2020-01-01T00:00:00Z' }, /déjà passée/, 'date passée'],
  [{ code: `P${RUN}`, discountType: 'percent', value: 10, oncePerCustomer: 'true' }, /une fois par client/, 'case « une fois » en texte'],
  [{ code: `P${RUN}`, discountType: 'percent', value: 10, maxUses: 0 }, /au moins 1/, 'limite à 0'],
];
for (const [body, pattern, label] of invalid) {
  r = await create(awa, body);
  check(`refusé : ${label} (400)`, r.status === 400 && pattern.test(msg(r)), { s: r.status, m: msg(r) });
}

const AWA20 = `AWA20${RUN}`;
r = await create(awa, { code: ` awa20${run} `, discountType: 'percent', value: 20 });
const awa20 = r.json;
check('code créé, mis en majuscules, libellé « −20 % »', r.status === 201 && awa20.code === AWA20 && awa20.label === '−20 %' && awa20.isActive && awa20.uses === 0, r.json);
r = await create(autre, { code: AWA20.toLowerCase(), discountType: 'percent', value: 5 });
check('même code chez un autre vendeur : 409', r.status === 409 && /existe déjà/.test(msg(r)), msg(r));
const AUTRE500 = `AUTRE500${RUN}`;
const autre500 = (await create(autre, { code: AUTRE500, discountType: 'amount', value: 500, maxUses: 2 })).json;
const AWA1000 = `AWA1000${RUN}`;
await create(awa, { code: AWA1000, discountType: 'amount', value: 1000 });
const AWA100 = `AWA100${RUN}`;
await create(awa, { code: AWA100, discountType: 'amount', value: 100 });
const FREE = `CADEAU${RUN}`;
await create(awa, { code: FREE, discountType: 'percent', value: 100, maxUses: 1 });
const EXPIRE = `FIN${RUN}`;
const expire = (await create(awa, { code: EXPIRE, discountType: 'percent', value: 10, expiresAt: new Date(Date.now() + 86_400_000).toISOString() })).json;
const BS10 = `BS10${RUN}`;
r = await create(null, { code: BS10, discountType: 'percent', value: 10, oncePerCustomer: true });
const bs10 = r.json;
check('codes en montant, avec limite, date de fin, et code BlackStore créés', !!autre500.id && !!expire.id && r.status === 201 && bs10.oncePerCustomer === true, r.json);
check('montant : libellé « −500 FCFA »', autre500.label.replace(/\s/g, ' ') === '−500 FCFA', autre500.label);

r = await call('GET', '/seller/promo-codes', { token: awa.token });
check('le vendeur ne voit que ses codes', r.json.codes.length === 5 && r.json.codes.every((c) => c.code.startsWith('AWA') || c.code === FREE || c.code === EXPIRE), r.json.codes.map((c) => c.code));
r = await call('GET', '/admin/promo-codes', { token: adminToken });
check('l’admin voit les codes BlackStore seulement', r.json.owner === 'BlackStore' && r.json.codes.some((c) => c.code === BS10) && !r.json.codes.some((c) => c.code === AWA20), r.json.codes.map((c) => c.code));
r = await call('PATCH', `/seller/promo-codes/${awa20.id}`, { token: autre.token, body: { isActive: false } });
check('un vendeur ne touche pas aux codes d’un autre (404)', r.status === 404, r.status);
r = await call('DELETE', `/seller/promo-codes/${bs10.id}`, { token: awa.token });
check('ni aux codes de BlackStore (404)', r.status === 404, r.status);
r = await call('PATCH', `/seller/promo-codes/${expire.id}`, { token: awa.token, body: { expiresAt: '2020-01-01T00:00:00Z' } });
check('nouvelle date de fin passée : 400', r.status === 400 && /déjà passée/.test(msg(r)), msg(r));
r = await call('PATCH', `/seller/promo-codes/${expire.id}`, { token: awa.token, body: { maxUses: 50, expiresAt: null } });
check('limite et date de fin modifiables (null = sans limite)', r.status === 200 && r.json.maxUses === 50 && r.json.expiresAt === null, r.json);

// ── Aperçu sur le panier ─────────────────────────────────────────────────
section('Aperçu sur le panier');
const cart = [one(p1), one(p2), one(q1), one(bs)];
r = await apply(` ${AWA20.toLowerCase()} `, cart);
check(
  '−20 % sur les seuls produits de la boutique',
  r.status === 200 && r.json.code === AWA20 && r.json.discount === 900 && r.json.subtotal === 8500 && r.json.total === 7600 &&
    r.json.discountByProduct[p1.id] === 600 && r.json.discountByProduct[p2.id] === 300 && !r.json.discountByProduct[q1.id] && r.json.storeName === awa.storeName,
  r.json,
);
r = await apply(AWA20, [one(p2, 2)]);
check('quantité 2 : réduction sur chaque exemplaire', r.json.discount === 600 && r.json.total === 2400, r.json);
r = await apply(AWA1000, [one(p2), one(p1)]);
check('montant : déduit une fois, sur le produit le plus cher', r.json.discount === 1000 && r.json.discountByProduct[p1.id] === 1000 && !r.json.discountByProduct[p2.id], r.json);
r = await apply(AWA1000, [one(p3)]);
check('montant supérieur au prix : produit gratuit (total 0)', r.status === 200 && r.json.discount === 150 && r.json.total === 0, r.json);
r = await apply(AWA100, [one(p3)]);
check('reste à payer entre 1 et 99 FCFA : refusé (minimum Mobile Money)', r.status === 400 && /il resterait 50 FCFA/.test(msg(r)), msg(r));
r = await apply(AWA20, [one(p3)]);
check('−20 % sur 150 FCFA : 30 de réduction, 120 à payer', r.json.discount === 30 && r.json.total === 120, r.json);
r = await apply(`INCONNU${RUN}`, cart);
check('code inconnu : 400', r.status === 400 && /n’existe pas/.test(msg(r)), msg(r));
r = await apply('NO EL!', cart);
check('code mal formé : même message', r.status === 400 && /n’existe pas/.test(msg(r)), msg(r));
r = await apply(AWA20, [one(q1)]);
check('aucun produit de la boutique : 400 qui nomme la boutique', r.status === 400 && msg(r).includes(`« ${awa.storeName} »`), msg(r));
r = await apply(AWA20, [one(free)]);
check('produit gratuit : non concerné', r.status === 400, r.status);
r = await apply(BS10, [one(p1)]);
check('code BlackStore sur un produit de vendeur : 400', r.status === 400 && /vendus par BlackStore/.test(msg(r)), msg(r));
r = await apply(AWA20, []);
check('panier vide : 400', r.status === 400, r.status);
const ip = `10.92.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const statuses = [];
for (let i = 0; i < 21; i++) statuses.push((await call('POST', '/promo-codes/apply', { body: { code: `ESSAI${i}`, items: cart }, ip })).status);
check('20 essais par minute et par adresse IP, puis 429', statuses.slice(0, 20).every((s) => s === 400) && statuses[20] === 429, statuses);

// ── Commande payée ───────────────────────────────────────────────────────
section('Commande payée avec un code');
const buyer = `acheteur.${run}@test.local`;
r = await order([one(p1), one(q1), one(bs)], { email: buyer, promoCode: AWA20.toLowerCase() });
const paid = r.json;
check(
  'commande : total réduit, code et réduction enregistrés',
  r.status === 201 && paid.totalAmount === 6400 && paid.discountAmount === 600 && paid.promoCodeText === AWA20 && statusOf(paid.id) === 'paid',
  { s: r.status, t: paid.totalAmount, d: paid.discountAmount, c: paid.promoCodeText, m: msg(r) },
);
const lines = sql(`select p.name || ':' || i.price_at_purchase || ':' || i.discount_amount from order_items i join products p on p.id = i.product_id where i.order_id = '${paid.id}' order by p.name`).split('\n');
check('articles : prix payé et réduction de chacun', lines.includes(`Formation ${run}:2400:600`) && lines.includes(`Logo ${run}:2000:0`) && lines.includes(`Logiciel BlackStore promo ${run}:2000:0`), lines);
const sale = sql(`select w.gross_amount || ':' || w.commission || ':' || w.amount from wallet_entries w join order_items i on i.id = w.order_item_id where i.order_id = '${paid.id}' and w.seller_id = '${awa.id}' and w.type = 'sale'`);
check('gains du vendeur : 10 % de commission sur le prix payé (2 400 → 2 160)', sale === '2400:240:2160', sale);
const saleAutre = sql(`select w.gross_amount || ':' || w.amount from wallet_entries w join order_items i on i.id = w.order_item_id where i.order_id = '${paid.id}' and w.seller_id = '${autre.id}' and w.type = 'sale'`);
check('l’autre vendeur garde son prix plein', saleAutre === '2000:1800', saleAutre);
await wait(800);
const confirmation = (await mails(buyer)).find((m) => m.subject.includes(paid.orderNumber));
check('e-mail de confirmation : code et réduction', !!confirmation && confirmation.body.includes(`Code promo <strong>${AWA20}</strong> : −600 FCFA déduits`), confirmation?.subject);
r = await call('POST', '/disputes/commande', { body: { orderNumber: paid.orderNumber, email: buyer } });
const disputable = r.json.items?.find((i) => i.productName === `Formation ${run}`);
check('remboursement possible : montant = prix payé (2 400)', r.status === 200 && disputable?.price === 2400, r.json);
r = await call('GET', '/seller/promo-codes', { token: awa.token });
const awaView = r.json.codes.find((c) => c.code === AWA20);
check('suivi du vendeur : 1 utilisation, 600 FCFA accordés', awaView.uses === 1 && awaView.discountGiven === 600, awaView);
r = await call('GET', '/orders/export', { token: adminToken });
check('export CSV des commandes : code et réduction', r.status === 200 && r.text.includes(`${paid.orderNumber},`) && r.text.split('\n').some((l) => l.startsWith(paid.orderNumber) && l.includes(`,6400,${AWA20},600,`)), r.text.split('\n')[0]);
r = await call('DELETE', `/seller/promo-codes/${awa20.id}`, { token: awa.token });
check('code utilisé : suppression refusée (409)', r.status === 409 && /désactivez-le/.test(msg(r)), msg(r));
r = await call('PATCH', `/seller/promo-codes/${awa20.id}`, { token: awa.token, body: { isActive: false } });
check('désactivation', r.status === 200 && r.json.isActive === false, r.json);
r = await apply(AWA20, cart);
check('code désactivé : refusé', r.status === 400 && /n’existe pas ou n’est plus actif/.test(msg(r)), msg(r));
await call('PATCH', `/seller/promo-codes/${awa20.id}`, { token: awa.token, body: { isActive: true } });
r = await apply(AWA20, cart);
check('réactivé : accepté', r.status === 200, r.status);

section('Refus à la commande');
const before = sql('select count(*) from orders');
r = await order([one(q1)], { promoCode: AWA20 });
check('code sans produit concerné : commande refusée (400), rien d’enregistré', r.status === 400 && /ne vaut que/.test(msg(r)) && sql('select count(*) from orders') === before, { s: r.status, m: msg(r) });
r = await order([one(p3)], { promoCode: AWA100 });
check('reste à payer < 100 FCFA : commande refusée', r.status === 400 && /au moins 100 FCFA/.test(msg(r)), msg(r));

// ── Limites ──────────────────────────────────────────────────────────────
section('Nombre d’utilisations');
const u1 = (await order([one(q1)], { promoCode: AUTRE500 })).json;
check('1re utilisation payée (2 000 → 1 500)', statusOf(u1.id) === 'paid' && u1.totalAmount === 1500, u1);
const u2 = (await order([one(q1)], { promoCode: AUTRE500, pay: false })).json;
check('2e utilisation en attente de paiement', statusOf(u2.id) === 'pending', u2);
r = await apply(AUTRE500, [one(q1)]);
check('la commande en attente réserve le code : 409', r.status === 409 && /autant de fois que prévu/.test(msg(r)), msg(r));
r = await order([one(q1)], { promoCode: AUTRE500 });
check('commande refusée aussi (409)', r.status === 409, r.status);
sql(`update orders set created_at = now() - interval '31 minutes' where id = '${u2.id}'`);
r = await apply(AUTRE500, [one(q1)]);
check('après 30 min sans paiement, la réservation tombe', r.status === 200, msg(r));
sql(`update orders set status = 'failed' where id = '${u2.id}'`);
r = await order([one(q1)], { promoCode: AUTRE500 });
check('paiement échoué : ne compte pas, nouvelle commande acceptée', r.status === 201 && statusOf(r.json.id) === 'paid', msg(r));
r = await apply(AUTRE500, [one(q1)]);
check('2 utilisations payées : code épuisé', r.status === 409, r.status);

section('Commandes simultanées (code à 1 utilisation, 100 %)');
const parallel = await Promise.all(Array.from({ length: 6 }, (_, i) => order([one(p2)], { email: `rapide${i}.${run}@test.local`, promoCode: FREE })));
const won = parallel.filter((p) => p.status === 201);
check('une seule commande passe, les autres : 409', won.length === 1 && parallel.filter((p) => p.status === 409).length === 5, parallel.map((p) => p.status));
check('commande gratuite grâce au code : payée, lien de téléchargement créé', won[0]?.json.totalAmount === 0 && statusOf(won[0].json.id) === 'paid' && sql(`select count(*) from download_tokens t join order_items i on i.id = t.order_item_id where i.order_id = '${won[0].json.id}'`) === '1', won[0]?.json);
check('aucun gain ni commission sur une vente à 0 FCFA', sql(`select count(*) from wallet_entries w join order_items i on i.id = w.order_item_id where i.order_id = '${won[0]?.json.id}'`) === '0');
check('base : une seule commande avec ce code', sql(`select count(*) from orders where promo_code_text = '${FREE}'`) === '1');

section('Une fois par client');
const fidele = `fidele.${run}@test.local`;
r = await order([one(bs)], { email: fidele, promoCode: BS10 });
check('1re commande avec le code BlackStore (2 000 → 1 800)', r.status === 201 && r.json.totalAmount === 1800 && statusOf(r.json.id) === 'paid', r.json);
r = await apply(BS10, [one(bs)], fidele.toUpperCase());
check('même client (majuscules) : 409', r.status === 409 && /qu’une fois par client/.test(msg(r)), msg(r));
r = await order([one(bs)], { email: fidele, promoCode: BS10 });
check('commande refusée aussi', r.status === 409, r.status);
r = await apply(BS10, [one(bs)], `nouveau.${run}@test.local`);
check('autre client : accepté', r.status === 200 && r.json.discount === 200 && r.json.oncePerCustomer === true, r.json);
r = await apply(BS10, [one(bs)]);
check('sans e-mail (aperçu) : accepté, contrôle fait à la commande', r.status === 200, r.status);

section('Expiration');
sql(`update promo_codes set expires_at = now() - interval '1 minute' where code = '${EXPIRE}'`);
r = await apply(EXPIRE, [one(p1)]);
check('code expiré : 400 avec la date', r.status === 400 && /a expiré le \d{1,2} \S+ 20\d\d/.test(msg(r)), msg(r));
r = await call('GET', '/seller/promo-codes', { token: awa.token });
check('liste du vendeur : code marqué expiré', r.json.codes.find((c) => c.code === EXPIRE)?.expired === true);

section('Suppression d’un code jamais utilisé');
r = await call('DELETE', `/seller/promo-codes/${expire.id}`, { token: awa.token });
check('supprimé', r.status === 200 && sql(`select count(*) from promo_codes where id = '${expire.id}'`) === '0', msg(r));

// ── Boutique ─────────────────────────────────────────────────────────────
section('Pages légales de la boutique');
const html = async (path) => {
  try {
    const res = await fetch(STOREFRONT + path);
    return { status: res.status, text: await res.text() };
  } catch {
    return { status: 0, text: '' };
  }
};
let page = await html('/conditions-generales');
if (page.status === 0) {
  console.log('  (boutique non démarrée : pages non vérifiées)');
} else {
  check('conditions générales : codes promo, version du 9 octobre', page.text.includes('Codes promo') && page.text.includes('9 octobre 2026'));
  page = await html('/conditions-vendeurs');
  check('conditions vendeurs : réduction à la charge du vendeur', page.text.includes('La réduction est à votre charge'));
}

console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko ? 1 : 0);
