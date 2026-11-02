// Essais de bout en bout de l'espace client et des liens des e-mails : liens vers la page de téléchargement
// (ouvrir la page ne compte rien), lien de connexion par e-mail, session, achats, déconnexion, purge.
// Usage : BS_ADMIN_PASSWORD=… BS_PG_PASS=… DATABASE_URL=… [STOREFRONT=http://localhost:3001] node e2e-client.mjs
import { execSync } from 'child_process';
import { createRequire } from 'module';

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
let ipCount = 0;
async function call(method, path, { body, token, form, ip } = {}) {
  const headers = { 'X-Real-IP': ip ?? `10.81.0.${++ipCount}` };
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
  return data.items.map((m) => ({ subject: decodeHeader(m.Content.Headers.Subject[0]), body: decodeQP(m.Content.Body) }));
}
const fileForm = (name, content, type) => {
  const form = new FormData();
  form.append('file', new Blob([content], { type }), name);
  return form;
};

// ── Préparation ─────────────────────────────────────────────────────────
section('Préparation');
const admin = (await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: process.env.BS_ADMIN_PASSWORD } })).json.accessToken;
check('connexion admin', !!admin);
const categoryId = (await call('GET', '/categories')).json[0].id;
async function product(name, price) {
  const p = (await call('POST', '/products', { token: admin, body: { name, description: 'Produit pour tester l’espace client.', price, categoryId } })).json;
  await call('POST', `/products/${p.id}/upload`, { token: admin, form: fileForm('guide.pdf', '%PDF-1.4 guide', 'application/pdf') });
  await call('PATCH', `/products/${p.id}`, { token: admin, body: { isActive: true } });
  return p;
}
const free = await product(`Guide offert ${run}`, 0);
const paid = await product(`Logiciel ${run}`, 1500);
const buyer = `client.espace.${run}@test.local`;
async function buy(productId, email, { pay = true } = {}) {
  const order = (await call('POST', '/orders', { body: { customerName: 'Mireille Nkoa', customerEmail: email, customerPhone: '699000088', items: [{ productId, quantity: 1 }], acceptTerms: true } })).json;
  if (order.status === 'paid' || !pay) return order;
  await call('POST', '/payments/initiate', { body: { orderId: order.id } });
  const reference = sql(`select payment_reference from orders where id = '${order.id}'`);
  await call('POST', '/payments/notify', { body: { transaction_id: reference } });
  return order;
}
const orderFree = await buy(free.id, buyer);
const orderPaid = await buy(paid.id, buyer.toUpperCase());
const orderPending = await buy(paid.id, buyer, { pay: false });
const orderOther = await buy(free.id, `autre.${run}@test.local`);
const status = (o) => sql(`select status from orders where id = '${o.id}'`);
check('commandes : gratuite, payée (adresse en majuscules), en attente, autre client', status(orderFree) === 'paid' && status(orderPaid) === 'paid' && status(orderPending) === 'pending' && status(orderOther) === 'paid');
const tokenFree = sql(`select dt.token from download_tokens dt join order_items oi on oi.id = dt.order_item_id where oi.order_id = '${orderFree.id}'`);

// ── Liens des e-mails ──────────────────────────────────────────────────
section('Liens des e-mails vers la page de téléchargement');
await wait(1200);
const downloadMail = (await mails(buyer)).find((m) => m.body.includes(tokenFree));
check('e-mail : lien vers la page de la boutique, plus vers le fichier', !!downloadMail && downloadMail.body.includes(`${STOREFRONT}/telechargement/${tokenFree}`) && !downloadMail.body.includes(`/downloads/${tokenFree}`), downloadMail?.body.slice(0, 300));
check('e-mail : lien vers « Mes achats »', !!downloadMail && downloadMail.body.includes(`${STOREFRONT}/mon-espace`));

// ── Lien de connexion ──────────────────────────────────────────────────
section('Lien de connexion par e-mail');
let r = await call('POST', '/client/lien', { body: { email: 'pas-une-adresse' } });
check('adresse mal formée refusée en français', r.status === 400 && /adresse e-mail/.test(msg(r)), msg(r));
r = await call('POST', '/client/lien', { body: { email: `inconnu.${run}@test.local` } });
const generic = r.json.message;
check('adresse sans achat : réponse normale…', r.status === 200 && /Si des achats sont liés/.test(generic), r.json);
await wait(800);
check('… mais aucun e-mail ni lien créé', (await mails(`inconnu.${run}@test.local`)).length === 0 && sql(`select count(*) from customer_login_tokens where email = 'inconnu.${run}@test.local'`) === '0');
r = await call('POST', '/client/lien', { body: { email: buyer.toUpperCase() } });
check('adresse avec achats : même réponse (on ne révèle rien)', r.status === 200 && r.json.message === generic, r.json);
await wait(1200);
const loginMail = (await mails(buyer)).find((m) => /lien de connexion/.test(m.subject));
const jeton = loginMail?.body.match(/mon-espace\/connexion\?jeton=([A-Za-z0-9_-]+)/)?.[1];
check('e-mail de connexion reçu avec le lien', !!jeton && loginMail.body.includes('30 minutes'), loginMail?.subject);
check('seule l’empreinte du lien est enregistrée', sql(`select count(*) from customer_login_tokens where token_hash = '${jeton}'`) === '0' && sql(`select length(token_hash) from customer_login_tokens where email = '${buyer}'`) === '64');
r = await call('POST', '/client/lien', { body: { email: buyer } });
await wait(800);
check('nouvelle demande dans la minute : pas de second e-mail', r.status === 200 && (await mails(buyer)).filter((m) => /lien de connexion/.test(m.subject)).length === 1);

// ── Session ────────────────────────────────────────────────────────────
section('Ouverture de la session');
r = await call('POST', '/client/session', { body: { jeton: 'trop-court' } });
check('jeton mal formé refusé', r.status === 400, [r.status, msg(r)]);
r = await call('POST', '/client/session', { body: { jeton: 'x'.repeat(43) } });
check('jeton inconnu : lien expiré ou déjà utilisé (410)', r.status === 410 && /expiré ou a déjà servi/.test(msg(r)), [r.status, msg(r)]);
r = await call('POST', '/client/session', { body: { jeton } });
const session = r.json.token;
check('session ouverte pour 30 jours, adresse en minuscules', r.status === 200 && !!session && r.json.email === buyer && Math.abs(new Date(r.json.expiresAt) - Date.now() - 30 * 86400000) < 120000, r.json);
r = await call('POST', '/client/session', { body: { jeton } });
check('le lien ne sert qu’une fois', r.status === 410, r.status);
sql(`delete from customer_login_tokens where email = '${buyer}'`);
await call('POST', '/client/lien', { body: { email: buyer } });
await wait(1200);
const jeton2 = (await mails(buyer)).map((m) => m.body.match(/mon-espace\/connexion\?jeton=([A-Za-z0-9_-]+)/)?.[1]).find((j) => j && j !== jeton);
sql(`update customer_login_tokens set expires_at = now() - interval '1 minute' where email = '${buyer}' and used_at is null`);
r = await call('POST', '/client/session', { body: { jeton: jeton2 } });
check('lien de plus de 30 minutes refusé', !!jeton2 && r.status === 410, [r.status, !!jeton2]);

// ── Achats ─────────────────────────────────────────────────────────────
section('Mes achats');
r = await call('GET', '/client/achats');
check('sans session : 401 en français', r.status === 401 && /session a expiré/.test(msg(r)), [r.status, msg(r)]);
r = await call('GET', '/client/achats', { token: 'faux-jeton-de-session' });
check('session inventée refusée', r.status === 401, r.status);
r = await call('GET', '/client/achats', { token: session });
const numbers = r.json.orders?.map((o) => o.orderNumber) ?? [];
check('achats payés de cette adresse, adresse en majuscules comprise', r.status === 200 && numbers.includes(orderFree.orderNumber) && numbers.includes(orderPaid.orderNumber), numbers);
check('ni commande en attente, ni achats d’une autre adresse', !numbers.includes(orderPending.orderNumber) && !numbers.includes(orderOther.orderNumber), numbers);
let itemFree = r.json.orders.find((o) => o.orderNumber === orderFree.orderNumber).items[0];
let itemPaid = r.json.orders.find((o) => o.orderNumber === orderPaid.orderNumber).items[0];
check('lien valable avec ses téléchargements restants', itemFree.download?.etat === 'valide' && itemFree.download.remaining === 3 && itemFree.download.token === tokenFree, itemFree.download);
check('remboursement proposé pour le produit payant seulement', !!itemPaid.refundUntil && itemFree.refundUntil === null, [itemPaid.refundUntil, itemFree.refundUntil]);
check('aucune donnée d’autres clients dans la réponse', !r.text.includes(`autre.${run}`));

const itemPaidId = sql(`select id from order_items where order_id = '${orderPaid.id}'`);
await call('POST', '/disputes', {
  body: { orderNumber: orderPaid.orderNumber, email: buyer, orderItemId: itemPaidId, reason: 'unusable', description: 'Le logiciel refuse de s’installer sur mon ordinateur.', refundOperator: 'orange', refundPhone: '699112233', refundAccountName: 'Mireille Nkoa' },
});
sql(`update download_tokens set expires_at = now() - interval '1 hour' where token = '${tokenFree}'`);
r = await call('GET', '/client/achats', { token: session });
itemFree = r.json.orders.find((o) => o.orderNumber === orderFree.orderNumber).items[0];
itemPaid = r.json.orders.find((o) => o.orderNumber === orderPaid.orderNumber).items[0];
check('demande de remboursement suivie dans l’espace', /^LIT-/.test(itemPaid.dispute?.reference ?? '') && itemPaid.dispute.status === 'review' && itemPaid.refundUntil === null, itemPaid);
check('lien expiré signalé', itemFree.download?.etat === 'expire', itemFree.download);
await call('PATCH', `/orders/${orderFree.id}/refund`, { token: admin });
r = await call('GET', '/client/achats', { token: session });
const refunded = r.json.orders.find((o) => o.orderNumber === orderFree.orderNumber);
check('commande remboursée : statut et lien désactivé', refunded?.status === 'refunded' && refunded.items[0].download?.etat === 'annule', refunded);

// ── Déconnexion et expiration ──────────────────────────────────────────
section('Déconnexion et expiration');
r = await call('POST', '/client/deconnexion', { token: session });
check('déconnexion', r.status === 200, r.status);
r = await call('GET', '/client/achats', { token: session });
check('après déconnexion, la session ne marche plus', r.status === 401, r.status);
sql(`delete from customer_login_tokens where email = '${buyer}'`);
await call('POST', '/client/lien', { body: { email: buyer } });
await wait(1200);
const jeton3 = (await mails(buyer)).map((m) => m.body.match(/mon-espace\/connexion\?jeton=([A-Za-z0-9_-]+)/)?.[1]).find((j) => j && j !== jeton && j !== jeton2);
const session2 = (await call('POST', '/client/session', { body: { jeton: jeton3 } })).json.token;
sql(`update customer_sessions set expires_at = now() - interval '1 minute' where email = '${buyer}'`);
r = await call('GET', '/client/achats', { token: session2 });
check('session de plus de 30 jours refusée', !!session2 && r.status === 401, [r.status, !!session2]);

section('Purge des accès expirés');
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { PrismaClient } = requireApi('@prisma/client');
const { RetentionService } = requireApi('./dist/src/modules/backups/retention.service.js');
const prisma = new PrismaClient();
const before = Number(sql(`select count(*) from customer_login_tokens where expires_at < now()`)) + Number(sql(`select count(*) from customer_sessions where expires_at < now()`));
const purged = await new RetentionService(prisma).purge();
await prisma.$disconnect();
check('liens et sessions expirés effacés par la purge de nuit', purged.clientAccess === before && before > 0 && sql(`select count(*) from customer_sessions where expires_at < now()`) === '0', [purged, before]);

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
  const fresh = await buy(free.id, `page.${run}@test.local`);
  const token = sql(`select dt.token from download_tokens dt join order_items oi on oi.id = dt.order_item_id where oi.order_id = '${fresh.id}'`);
  let p = await html(`/telechargement/${token}`);
  check('page ouverte depuis l’e-mail : aucun téléchargement compté', p.status === 200 && p.text.includes('Votre fichier est prêt') && sql(`select download_count from download_tokens where token = '${token}'`) === '0');
  p = await html('/mon-espace');
  check('page « Mes achats »', p.status === 200 && p.text.includes('Mes achats') && p.text.includes('name="robots" content="noindex"'), p.status);
  check('lien « Mes achats » dans l’en-tête', p.text.includes('href="/mon-espace"'));
  p = await html(`/mon-espace/connexion?jeton=${'a'.repeat(43)}`);
  check('page de connexion : bouton, non indexée, sans référent', p.text.includes('Ouvrir mon espace') && p.text.includes('content="noindex, nofollow"') && p.text.includes('name="referrer" content="no-referrer"'));
  p = await html('/conditions-generales');
  check('conditions générales : espace « Mes achats », version du 9 octobre', p.text.includes('href="/mon-espace"') && p.text.includes('9 octobre 2026'));
  p = await html('/confidentialite');
  check('confidentialité : liens de connexion et sessions', p.text.includes('Espace client : liens de connexion et sessions'));
}

console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko ? 1 : 0);
