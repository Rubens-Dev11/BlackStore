// Essais de bout en bout des statistiques par vendeur contre l'API de test (port 3100), avec le faux CinetPay
// (port 3998) : suivi des visites (provenance, page boutique, IP hachée avec clé), chiffres du vendeur
// (vues, ventes, gains, remboursements, produits, sources, périodes), classement admin, relevé mensuel.
// Usage : BS_ADMIN_PASSWORD=… BS_PG_PASS=… [STOREFRONT=http://localhost:3001] node e2e-stats.mjs
import { execSync } from 'child_process';
import { createHash } from 'crypto';

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
  const headers = { 'X-Real-IP': ip ?? `10.93.${Math.floor(ipCount / 250)}.${(ipCount++ % 250) + 1}` };
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
async function mails(email) {
  const data = await (await fetch(`http://localhost:8028/api/v2/search?kind=to&query=${encodeURIComponent(email)}`)).json();
  return data.items.map((m) => ({ body: decodeQP(m.Content.Body) }));
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
  await call('POST', '/seller/auth/register', { body: { firstName: 'Awa', lastName: 'Ngono', email, phone: '677001133', password: 'vendeur2026', acceptTerms: true }, ip: '10.94.0.1' });
  await wait(800);
  const token0 = (await mails(email)).map((m) => m.body.match(/token=([a-f0-9]{64})/)?.[1]).find(Boolean);
  await call('POST', '/seller/auth/verify-email', { body: { token: token0 } });
  const token = (await call('POST', '/seller/auth/login', { body: { email, password: 'vendeur2026' } })).json.accessToken;
  const id = (await call('GET', '/seller/me', { token })).json.id;
  await call('PATCH', `/admin/sellers/${id}/status`, { token: adminToken, body: { status: 'approved' } });
  return { email, token, id };
}
async function publish(seller, name, price) {
  const p = (await call('POST', '/seller/products', {
    token: seller.token,
    body: { name, price, categoryId, description: 'Un produit pour tester les statistiques des vendeurs.' },
  })).json;
  await call('POST', `/seller/products/${p.id}/cover`, { token: seller.token, form: fileForm('file', 'c.png', PNG, 'image/png') });
  await call('POST', `/seller/products/${p.id}/file`, { token: seller.token, form: fileForm('file', 'f.pdf', '%PDF-1.4 x', 'application/pdf') });
  for (let i = 0; i < 40 && (await call('GET', `/seller/products/${p.id}`, { token: seller.token })).json.scanStatus !== 'clean'; i++) await wait(250);
  const s = (await call('POST', `/seller/products/${p.id}/submit`, { token: seller.token, body: { certifyRights: true } })).json;
  if (s.reviewStatus === 'pending') await call('PATCH', `/admin/products/${p.id}/review`, { token: adminToken, body: { decision: 'approve' } });
  return p;
}
async function order(items, { promoCode, pay = true } = {}) {
  const r = await call('POST', '/orders', { body: { customerName: 'Client Stats', customerEmail: `client.${run}@test.local`, customerPhone: '699000099', items, acceptTerms: true, promoCode } });
  if (r.status !== 201 || r.json.status === 'paid' || !pay) return r.json;
  await call('POST', '/payments/initiate', { body: { orderId: r.json.id } });
  const reference = sql(`select payment_reference from orders where id = '${r.json.id}'`);
  await call('POST', '/payments/notify', { body: { transaction_id: reference } });
  return r.json;
}
const one = (p) => ({ productId: p.id, quantity: 1 });

const awa = await registerSeller('stats');
const slug = `stats-${run}`;
await call('PUT', '/seller/store', { token: awa.token, body: { name: `Boutique stats ${run}`, slug } });
const p1 = await publish(awa, `Formation stats ${run}`, 3000);
const p2 = await publish(awa, `Modèles stats ${run}`, 1500);
const free = await publish(awa, `Guide stats ${run}`, 0);
const sansBoutique = await registerSeller('statsvide');
check('vendeur, boutique et produits prêts', !!p1.id && !!p2.id && !!free.id);

// ── Suivi des visites ────────────────────────────────────────────────────
section('Suivi des visites');
const track = (body, ip) => call('POST', '/analytics/pageview', { body, ip });
const X1 = `10.95.${Math.floor(Math.random() * 250)}.1`;
await track({ productId: p1.id, utmSource: ' Facebook ', utmMedium: 'Social', sessionId: 's1' }, X1);
await track({ productId: p1.id, referrerHost: 'l.facebook.com' }, '10.95.0.2');
await track({ productId: p2.id, referrerHost: 'www.google.com' }, '10.95.0.4');
await track({ storeSlug: slug }, X1);
await track({ productId: p2.id }, '10.95.0.3');
const rows = sql(`select coalesce(utm_source,'-') || '|' || coalesce(utm_medium,'-') || '|' || coalesce(referrer_host,'-') || '|' || coalesce(store_id,'-') from page_views where product_id in ('${p1.id}','${p2.id}') or store_id = (select id from stores where slug = '${slug}') order by created_at`).split('\n');
check('provenance enregistrée (campagne en minuscules, « www. » retiré)', rows[0] === 'facebook|social|-|-' && rows[1] === '-|-|l.facebook.com|-' && rows[2] === '-|-|google.com|-', rows);
check('page boutique : vue enregistrée avec la boutique', rows[3].startsWith('-|-|-|') && rows[3].split('|')[3].length === 36, rows[3]);
const hashes = sql(`select ip_hash from page_views where store_id = (select id from stores where slug = '${slug}') or (product_id = '${p1.id}' and utm_source = 'facebook')`).split('\n');
check('adresse IP hachée avec une clé (pas un simple SHA-256), même visiteur = même empreinte', hashes.length === 2 && hashes[0] === hashes[1] && hashes[0] !== createHash('sha256').update(X1).digest('hex'), hashes);
let r = await track({ storeSlug: 'Pas Valide!' });
check('adresse de boutique invalide : 400', r.status === 400, r.status);
r = await track({ productId: p1.id, referrerHost: 'site invalide' });
check('site d’origine invalide : 400', r.status === 400, r.status);
const before = sql('select count(*) from page_views');
r = await track({ storeSlug: `inconnue-${run}` });
check('boutique inconnue : accepté, rien d’enregistré', r.status === 200 && sql('select count(*) from page_views') === before, r.status);
const flood = `10.96.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const statuses = [];
for (let i = 0; i < 61; i++) statuses.push((await track({ productId: '00000000-0000-4000-8000-000000000000' }, flood)).status);
check('60 vues par minute et par adresse IP, puis 429', statuses.slice(0, 60).every((s) => s === 200) && statuses[60] === 429, statuses.slice(58));

// ── Ventes ───────────────────────────────────────────────────────────────
section('Ventes');
const CODE = `STATS10${RUN}`;
await call('POST', '/seller/promo-codes', { token: awa.token, body: { code: CODE, discountType: 'percent', value: 10 } });
const o1 = await order([one(p1)], { promoCode: CODE });
const o2 = await order([one(p2)]);
const o3 = await order([one(free)]);
const o4 = await order([one(p1), one(p2)]);
const o5 = await order([one(p1)], { pay: false });
r = await call('PATCH', `/orders/${o2.id}/refund`, { token: adminToken });
check('commandes : code promo, gratuit, double, en attente ; une remboursée', o1.totalAmount === 2700 && o3.status === 'paid' && o4.totalAmount === 4500 && o5.status === 'pending' && r.status === 200, { o1: o1.totalAmount, o4: o4.totalAmount, r: r.status });

// ── Statistiques du vendeur ─────────────────────────────────────────────
section('Statistiques du vendeur (30 jours)');
r = await call('GET', '/seller/stats', { token: awa.token });
const s = r.json;
check('boutique et période par défaut (30 jours, par jour)', r.status === 200 && s.hasStore && s.store.slug === slug && s.period.key === '30j' && s.period.granularity === 'day', { s: r.status, p: s.period });
check('visites : 5 dont 1 sur la page boutique, 4 visiteurs', s.totals.views === 5 && s.totals.storeViews === 1 && s.totals.productViews === 4 && s.totals.visitors === 4, s.totals);
check('ventes : 4 payantes (dont la remboursée), 1 gratuite ; la commande en attente ne compte pas', s.totals.sales === 4 && s.totals.freeItems === 1, s.totals);
check('chiffre d’affaires 8 700 (prix payés), 300 de réductions', s.totals.revenue === 8700 && s.totals.discounts === 300, s.totals);
check('commission 870 et gains 7 830 (registre du portefeuille)', s.totals.commission === 870 && s.totals.net === 7830, s.totals);
check('remboursement : 1, 1 500 rendus', s.totals.refunds === 1 && s.totals.refundedAmount === 1500, s.totals);
check('conversion : 5 produits obtenus pour 4 vues de fiches = 125 %', s.totals.conversionRate === 125, s.totals.conversionRate);
check('période précédente vide', s.previous.views === 0 && s.previous.sales === 0 && s.previous.revenue === 0, s.previous);
const today = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
const last = s.series.at(-1);
check('graphique : 30 jours, aujourd’hui (heure du Cameroun) en dernier avec tout', s.series.length === 30 && last.bucket === today && last.views === 5 && last.sales === 4 && last.revenue === 8700, last);
const prod1 = s.products.find((p) => p.id === p1.id);
const prodFree = s.products.find((p) => p.id === free.id);
check('produits : le plus vendu en premier, vues, ventes, CA, conversion', s.products[0].id === p1.id && prod1.views === 2 && prod1.sales === 2 && prod1.revenue === 5700 && prod1.conversionRate === 100, s.products[0]);
check('produit gratuit : 1 obtenu, 0 vente', prodFree.freeItems === 1 && prodFree.sales === 0 && prodFree.revenue === 0, prodFree);
const src = Object.fromEntries(s.sources.map((x) => [x.label, x.views]));
check('provenance regroupée : Facebook 2, Google 1, direct 2', src.Facebook === 2 && src.Google === 1 && src['Accès direct ou inconnu'] === 2 && s.sources[0].share === 40, s.sources);

section('Périodes');
sql(`update page_views set created_at = now() - interval '10 days' where product_id = '${p2.id}' and referrer_host = 'google.com'`);
r = await call('GET', '/seller/stats?period=7j', { token: awa.token });
check('7 jours : 4 visites, 1 la semaine précédente (+300 %)', r.json.totals.views === 4 && r.json.previous.views === 1 && r.json.series.length === 7, { t: r.json.totals.views, p: r.json.previous });
r = await call('GET', '/seller/stats?period=12m', { token: awa.token });
check('12 mois : par mois, 12 cases, le mois en cours en dernier', r.json.period.granularity === 'month' && r.json.series.length === 12 && r.json.series.at(-1).bucket === today.slice(0, 7) && r.json.series.at(-1).revenue === 8700, r.json.series.at(-1));
r = await call('GET', '/seller/stats?period=1an', { token: awa.token });
check('période inconnue : 400', r.status === 400 && /7j, 30j, 90j ou 12m/.test(msg(r)), msg(r));
r = await call('GET', '/seller/stats', { token: sansBoutique.token });
check('vendeur sans boutique : hasStore false', r.status === 200 && r.json.hasStore === false, r.json);
r = await call('GET', '/seller/stats');
check('sans connexion : 401', r.status === 401, r.status);

// ── Relevé mensuel ───────────────────────────────────────────────────────
section('Relevé mensuel');
const month = today.slice(0, 7);
sql(`insert into withdrawals (id, seller_id, amount, operator, phone, account_name, status, transfer_reference, processed_at, created_at) values ('11111111-2222-4333-8444-${run.padStart(12, '0').slice(-12)}', '${awa.id}', 5000, 'mtn', '+237677001133', 'Awa Ngono', 'paid', 'MP-${RUN}', now(), now())`);
sql(`insert into wallet_entries (id, seller_id, type, amount, available_at, withdrawal_id, created_at) values (gen_random_uuid(), '${awa.id}', 'withdrawal', -5000, now(), (select id from withdrawals where transfer_reference = 'MP-${RUN}'), now())`);
r = await call('GET', `/seller/stats/report?month=${month}`, { token: awa.token });
const rep = r.json;
const firstSale = rep.sales?.find((x) => x.orderNumber === o1.orderNumber);
check('ventes du mois : 4 lignes, prix, réduction, commission, gain', r.status === 200 && rep.sales.length === 4 && firstSale.listPrice === 3000 && firstSale.discount === 300 && firstSale.paid === 2700 && firstSale.commission === 270 && firstSale.net === 2430, firstSale);
check('remboursement : 1 500 rendus, 1 350 retirés des gains', rep.refunds.length === 1 && rep.refunds[0].paid === 1500 && rep.refunds[0].net === 1350 && rep.refunds[0].orderNumber === o2.orderNumber, rep.refunds);
check('retrait payé avec sa référence', rep.withdrawals.length === 1 && rep.withdrawals[0].amount === 5000 && rep.withdrawals[0].status === 'paid' && rep.withdrawals[0].reference === `MP-${RUN}`, rep.withdrawals);
check('totaux : 8 700 payés, 300 de réductions, 870 de commission, 7 830 de gains', rep.totals.paid === 8700 && rep.totals.discounts === 300 && rep.totals.commission === 870 && rep.totals.net === 7830 && rep.totals.refundedNet === 1350 && rep.totals.withdrawn === 5000, rep.totals);
check('solde : 0 au début, 1 480 à la fin (7 830 − 1 350 − 5 000)', rep.balance.opening === 0 && rep.balance.closing === 1480, rep.balance);
r = await call('GET', '/seller/stats/report?month=2026-13', { token: awa.token });
check('mois invalide : 400', r.status === 400, r.status);
r = await call('GET', '/seller/stats/report?month=2099-01', { token: awa.token });
check('mois à venir : 400', r.status === 400 && /pas encore commencé/.test(msg(r)), msg(r));
const previousMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 2, 15)).toISOString().slice(0, 7);
r = await call('GET', `/seller/stats/report?month=${previousMonth}`, { token: awa.token });
check('mois précédent : vide, solde à 0', r.status === 200 && r.json.sales.length === 0 && r.json.balance.closing === 0, r.json.totals);

// ── Admin ────────────────────────────────────────────────────────────────
section('Admin');
r = await call('GET', `/admin/stats/sellers/${awa.id}`, { token: adminToken });
check('statistiques d’un vendeur : les mêmes chiffres', r.status === 200 && r.json.totals.revenue === 8700 && r.json.totals.views === 5 && r.json.seller.id === awa.id, r.json.totals);
r = await call('GET', `/admin/stats/sellers/${awa.id}/report?month=${month}`, { token: adminToken });
check('relevé d’un vendeur', r.status === 200 && r.json.balance.closing === 1480, r.json.balance);
r = await call('GET', '/admin/stats/sellers', { token: adminToken });
const line = r.json.sellers?.find((x) => x.sellerId === awa.id);
check('classement : la boutique avec ses chiffres', r.status === 200 && line?.storeName === `Boutique stats ${run}` && line.sales === 4 && line.revenue === 8700 && line.commission === 870 && line.refunds === 1 && line.products === 3 && line.views === 5, line);
check('classement : ligne BlackStore et vendeurs sans boutique absents', r.json.sellers.some((x) => x.sellerId === null && x.storeName === 'BlackStore') && !r.json.sellers.some((x) => x.sellerId === sansBoutique.id), r.json.sellers.length);
check('classement : commission totale ≥ celle de la boutique', r.json.totals.commission >= 870 && r.json.totals.sellersRevenue >= 8700, r.json.totals);
r = await call('GET', '/admin/stats/sellers', { token: awa.token });
check('un vendeur n’a pas accès au classement (401)', r.status === 401, r.status);
r = await call('GET', `/admin/stats/sellers/${awa.id}`, { token: awa.token });
check('ni aux statistiques par l’admin (401)', r.status === 401, r.status);
r = await call('GET', '/admin/stats/sellers/00000000-0000-4000-8000-000000000000', { token: adminToken });
check('vendeur inconnu : 404', r.status === 404, r.status);

// ── Boutique ─────────────────────────────────────────────────────────────
section('Politique de confidentialité');
try {
  const page = await (await fetch(`${STOREFRONT}/confidentialite`)).text();
  check('provenance des visites et clé secrète mentionnées', page.includes('site d') && page.includes('clé secrète') && page.includes('jamais vos données'));
} catch {
  console.log('  (boutique non démarrée : page non vérifiée)');
}

console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko ? 1 : 0);
