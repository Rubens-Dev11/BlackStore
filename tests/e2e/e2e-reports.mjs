// Essais de bout en bout des signalements contre l'API de test (port 3100).
// Usage : BS_ADMIN_PASSWORD=… node e2e-reports.mjs
const API = 'http://localhost:3100';
const run = Date.now().toString(36);
// Adresses simulées propres à chaque passage (la limite de 5 signalements par heure reste en mémoire de l'API).
const NET = `10.${30 + Math.floor(Math.random() * 200)}`;
let nextIp = 1;
const freshIp = () => `${NET}.1.${nextIp++}`;
let ok = 0;
let ko = 0;
const check = (label, condition, detail) => {
  condition ? ok++ : ko++;
  console.log(`  ${condition ? '✓' : '✗'} ${label}${condition ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
};
const section = (title) => console.log(`\n${title}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, { body, token, form, ip = `${NET}.0.1` } = {}) {
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
const formWith = (field, name, content, type) => {
  const form = new FormData();
  form.append(field, new Blob([content], { type }), name);
  return form;
};

// ── Préparation : un vendeur validé avec un produit en ligne ─────────────
section('Préparation');
const adminToken = (await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: process.env.BS_ADMIN_PASSWORD } })).json.accessToken;
check('connexion admin', !!adminToken);
const categoryId = (await call('GET', '/categories')).json[0].id;
const email = `signale.${run}@test.local`;
await call('POST', '/seller/auth/register', { body: { firstName: 'Koffi', lastName: 'Test', email, phone: '699000011', password: 'vendeur2026', acceptTerms: true } });
await wait(800);
const verifyToken = (await mails(email)).map((m) => m.body.match(/token=([a-f0-9]{64})/)?.[1]).find(Boolean);
await call('POST', '/seller/auth/verify-email', { body: { token: verifyToken } });
const sellerToken = (await call('POST', '/seller/auth/login', { body: { email, password: 'vendeur2026' } })).json.accessToken;
const sellerId = (await call('GET', '/seller/me', { token: sellerToken })).json.id;
await call('PATCH', `/admin/sellers/${sellerId}/status`, { token: adminToken, body: { status: 'approved' } });
await call('PUT', '/seller/store', { token: sellerToken, body: { name: `Koffi ${run}`, slug: `koffi-${run}` } });

async function publishedProduct(name) {
  const p = (await call('POST', '/seller/products', {
    token: sellerToken,
    body: { name, price: 0, categoryId, description: 'Un produit de test pour les signalements, avec assez de texte.' },
  })).json;
  await call('POST', `/seller/products/${p.id}/cover`, { token: sellerToken, form: formWith('file', 'c.png', PNG, 'image/png') });
  await call('POST', `/seller/products/${p.id}/file`, { token: sellerToken, form: formWith('file', 'guide.pdf', '%PDF-1.4 test', 'application/pdf') });
  for (let i = 0; i < 40; i++) {
    if ((await call('GET', `/seller/products/${p.id}`, { token: sellerToken })).json.scanStatus === 'clean') break;
    await wait(250);
  }
  const submitted = (await call('POST', `/seller/products/${p.id}/submit`, { token: sellerToken, body: { certifyRights: true } })).json;
  if (submitted.reviewStatus === 'pending') {
    await call('PATCH', `/admin/products/${p.id}/review`, { token: adminToken, body: { decision: 'approve' } });
  }
  return (await call('GET', `/seller/products/${p.id}`, { token: sellerToken })).json;
}
const p1 = await publishedProduct(`Guide signalable ${run}`);
check('produit de vendeur en ligne', p1.isPublic === true, p1);
const blackstore = (await call('GET', '/products/app-demo-android-v1')).json;
check('produit BlackStore en ligne', !!blackstore.id, blackstore);
const draft = (await call('POST', '/seller/products', { token: sellerToken, body: { name: `Brouillon ${run}`, price: 0, categoryId } })).json;

section('Signalement depuis le site');
let r = await call('POST', '/reports', { ip: freshIp(), body: { productId: p1.id, reason: 'virus' } });
check('motif inconnu : 400', r.status === 400, msg(r));
r = await call('POST', '/reports', { ip: freshIp(), body: { productId: 'abc', reason: 'piracy' } });
check('produit invalide : 400', r.status === 400, msg(r));
r = await call('POST', '/reports', { ip: freshIp(), body: { productId: '0b3d961d-dcd0-4d72-9e21-11950764ad45', reason: 'piracy' } });
check('produit inconnu : 404', r.status === 404, r.status);
r = await call('POST', '/reports', { ip: freshIp(), body: { productId: draft.id, reason: 'piracy' } });
check('produit invisible (brouillon) : 404', r.status === 404, r.status);
r = await call('POST', '/reports', { ip: freshIp(), body: { productId: p1.id, reason: 'other' } });
check('« autre » sans précision : 400', r.status === 400 && /10 caractères/.test(msg(r)), msg(r));
r = await call('POST', '/reports', { ip: freshIp(), body: { productId: p1.id, reason: 'piracy', email: 'pas-un-email' } });
check('e-mail invalide : 400', r.status === 400, msg(r));
r = await call('POST', '/reports', { ip: freshIp(), body: { productId: p1.id, reason: 'piracy', isAdmin: true } });
check('champ inconnu refusé', r.status === 400, msg(r));

r = await call('POST', '/reports', {
  ip: `${NET}.0.2`,
  body: { productId: p1.id, reason: 'piracy', details: 'C’est une copie du guide payant de X.', email: 'Client@Test.local' },
});
check('signalement reçu', r.status === 201 && r.json.received === true, r);
r = await call('POST', '/reports', { ip: `${NET}.0.2`, body: { productId: p1.id, reason: 'scam' } });
check('même visiteur, même produit : accepté sans doublon', r.status === 201, r);
r = await call('POST', '/reports', { ip: `${NET}.0.3`, body: { productId: p1.id, reason: 'malware' } });
check('second visiteur : signalement reçu', r.status === 201, r);
r = await call('POST', '/reports', { ip: `${NET}.0.4`, body: { productId: blackstore.id, reason: 'broken', details: 'Le fichier ne s’ouvre pas.' } });
check('signalement d’un produit BlackStore', r.status === 201, r);
r = await call('POST', '/reports', { ip: `${NET}.0.5`, body: { productId: blackstore.id, reason: 'other', details: 'La description est fausse.' } });
check('second signalement du produit BlackStore', r.status === 201, r);

let statuses = [];
for (let i = 0; i < 6; i++) {
  statuses.push((await call('POST', '/reports', { ip: `${NET}.0.9`, body: { productId: blackstore.id, reason: 'broken' } })).status);
}
check('6e signalement de l’heure depuis la même adresse : 429', statuses.slice(0, 5).every((s) => s === 201) && statuses[5] === 429, statuses);

section('Traitement par l’admin');
r = await call('GET', '/admin/reports');
check('liste refusée sans connexion', r.status === 401, r.status);
r = await call('GET', '/admin/reports', { token: sellerToken });
check('liste refusée à un vendeur', r.status === 401, r.status);
r = await call('GET', '/admin/reports', { token: adminToken });
const open = r.json;
const p1Reports = open.filter((x) => x.product.id === p1.id);
check('2 signalements du produit vendeur (doublon ignoré)', p1Reports.length === 2, p1Reports.length);
check('compteur par produit', p1Reports.every((x) => x.openReportsOnProduct === 2), p1Reports.map((x) => x.openReportsOnProduct));
const withEmail = p1Reports.find((x) => x.reason === 'piracy');
check('e-mail du visiteur normalisé', withEmail?.reporterEmail === 'client@test.local', withEmail?.reporterEmail);
check('vendeur et boutique présentés', withEmail?.product.seller?.email === email && withEmail?.product.store?.slug === `koffi-${run}`, withEmail?.product);
check('lien vers la fiche', withEmail?.product.publicUrl.endsWith(`/produits/${p1.slug}`), withEmail?.product.publicUrl);
const bsReports = open.filter((x) => x.product.id === blackstore.id);
check('signalements du produit BlackStore (sans vendeur)', bsReports.length >= 3 && bsReports[0].product.seller === null, bsReports.length);

r = await call('PATCH', `/admin/reports/${withEmail.id}`, { token: adminToken, body: { action: 'remove-product' } });
check('retrait sans motif : 400', r.status === 400, msg(r));
r = await call('PATCH', `/admin/reports/${bsReports[0].id}`, { token: adminToken, body: { action: 'dismiss' } });
check('classé sans suite', r.status === 200 && r.json.status === 'dismissed' && r.json.resolutionNote === 'Classé sans suite', r.json);
r = await call('PATCH', `/admin/reports/${bsReports[0].id}`, { token: adminToken, body: { action: 'dismiss' } });
check('signalement déjà traité : 409', r.status === 409, r.status);
r = await call('GET', '/products/app-demo-android-v1');
check('produit toujours en ligne après classement', r.status === 200, r.status);

r = await call('PATCH', `/admin/reports/${withEmail.id}`, {
  token: adminToken,
  body: { action: 'remove-product', note: 'Copie d’un guide payant : droits non détenus.' },
});
check('produit du vendeur retiré', r.status === 200 && r.json.status === 'resolved' && r.json.product.onSale === false, r.json);
r = await call('GET', `/products/${p1.slug}`);
check('produit invisible sur le site', r.status === 404, r.status);
r = await call('GET', `/seller/products/${p1.id}`, { token: sellerToken });
check('le vendeur voit le refus et le motif', r.json.reviewStatus === 'rejected' && r.json.reviewNote === 'Copie d’un guide payant : droits non détenus.', r.json);
await wait(800);
check('e-mail au vendeur avec le motif', (await mails(email)).some((m) => /modifié/.test(m.subject) && m.body.includes('droits non d')));
r = await call('GET', '/admin/reports?status=resolved', { token: adminToken });
const resolvedP1 = r.json.filter((x) => x.product.id === p1.id);
check('les 2 signalements du produit sont résolus', resolvedP1.length === 2 && resolvedP1.every((x) => x.resolutionNote.startsWith('Produit retiré')), resolvedP1);
r = await call('POST', '/reports', { ip: `${NET}.0.6`, body: { productId: p1.id, reason: 'piracy' } });
check('produit retiré : plus signalable', r.status === 404, r.status);
r = await call('POST', `/seller/products/${p1.id}/submit`, { token: sellerToken, body: { certifyRights: true } });
check('resoumis par le vendeur : repasse par l’admin', r.json.reviewStatus === 'pending', r.json);

r = await call('PATCH', `/admin/reports/${bsReports[1].id}`, { token: adminToken, body: { action: 'remove-product', note: 'Fichier corrompu, à remplacer.' } });
check('produit BlackStore retiré', r.status === 200 && r.json.status === 'resolved', r.json);
r = await call('GET', '/products/app-demo-android-v1');
check('produit BlackStore invisible', r.status === 404, r.status);
r = await call('GET', '/admin/reports', { token: adminToken });
check('plus aucun signalement ouvert sur ces produits', !r.json.some((x) => x.product.id === blackstore.id || x.product.id === p1.id), r.json.length);

section('Suppression d’un produit signalé');
const p3 = await publishedProduct(`Produit éphémère ${run}`);
check('produit publié directement (vendeur de confiance)', p3.isPublic, p3);
r = await call('POST', '/reports', { ip: `${NET}.0.7`, body: { productId: p3.id, reason: 'scam' } });
check('produit signalé', r.status === 201, r);
r = await call('DELETE', `/seller/products/${p3.id}`, { token: sellerToken });
check('produit supprimé par le vendeur', r.status === 200, r);
r = await call('GET', '/admin/reports', { token: adminToken });
check('ses signalements disparaissent avec lui', !r.json.some((x) => x.product.id === p3.id), r.json.length);

console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko > 0 ? 1 : 0);
