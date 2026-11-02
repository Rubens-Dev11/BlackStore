// Essais de bout en bout des produits des vendeurs contre l'API de test (port 3100).
// Usage : BS_ADMIN_PASSWORD=… node e2e-products.mjs
const API = 'http://localhost:3100';
const ADMIN_PASSWORD = process.env.BS_ADMIN_PASSWORD;
const run = Date.now().toString(36);
let ok = 0;
let ko = 0;

const check = (label, condition, detail) => {
  if (condition) {
    ok++;
    console.log(`  ✓ ${label}`);
  } else {
    ko++;
    console.log(`  ✗ ${label}${detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
  }
};
const section = (title) => console.log(`\n${title}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, { body, token, form, ip = '10.9.9.9', redirect = 'follow' } = {}) {
  const headers = { 'X-Real-IP': ip };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    redirect,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
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

async function newSeller(label) {
  const email = `${label}.${run}@test.local`;
  await call('POST', '/seller/auth/register', {
    body: { firstName: 'Awa', lastName: 'Test', email, phone: '699000001', password: 'vendeur2026', acceptTerms: true },
  });
  await wait(800);
  const link = (await mails(email)).map((m) => m.body.match(/token=([a-f0-9]{64})/)?.[1]).find(Boolean);
  await call('POST', '/seller/auth/verify-email', { body: { token: link } });
  const login = await call('POST', '/seller/auth/login', { body: { email, password: 'vendeur2026' } });
  const me = await call('GET', '/seller/me', { token: login.json.accessToken });
  return { email, token: login.json.accessToken, id: me.json.id };
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const formWith = (field, files) => {
  const form = new FormData();
  for (const [name, content, type] of files) form.append(field, new Blob([content], { type }), name);
  return form;
};
async function waitScan(token, id, expected, timeoutMs = 20000) {
  const start = Date.now();
  let r;
  do {
    r = await call('GET', `/seller/products/${id}`, { token });
    if (r.json.scanStatus !== 'pending') break;
    await wait(500);
  } while (Date.now() - start < timeoutMs);
  return r;
}

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n' + 'contenu du guide '.repeat(200));

// ───────────────────────────────────────────────────────────────────────
section('Préparation');
const admin = await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: ADMIN_PASSWORD } });
check('connexion admin', admin.status === 200 || admin.status === 201, admin.status);
const adminToken = admin.json.accessToken;
const categories = (await call('GET', '/categories')).json;
const categoryId = categories[0]?.id;
check('catégories disponibles', !!categoryId, categories);

const awa = await newSeller('awa');
check('vendeur de test connecté', !!awa.token);
const noStore = await newSeller('sansboutique');

section('Création du brouillon');
let r = await call('POST', '/seller/products', { token: noStore.token, body: { name: 'Produit test', price: 0, categoryId } });
check('sans boutique : 409', r.status === 409, r);

r = await call('PUT', '/seller/store', { token: awa.token, body: { name: `Awa ${run}`, slug: `awa-${run}` } });
check('boutique créée', r.status === 200, r);

const base = { name: 'Guide d’été : créer sa boutique', price: 2500, categoryId };
r = await call('POST', '/seller/products', { token: awa.token, body: { ...base, price: 50 } });
check('prix 50 FCFA refusé', r.status === 400 && /100 FCFA/.test(msg(r)), msg(r));
r = await call('POST', '/seller/products', { token: awa.token, body: { ...base, price: 2503 } });
check('prix non multiple de 5 refusé', r.status === 400, msg(r));
r = await call('POST', '/seller/products', { token: awa.token, body: { ...base, originalPrice: 2000 } });
check('prix barré inférieur refusé', r.status === 400 && /barré/.test(msg(r)), msg(r));
r = await call('POST', '/seller/products', { token: awa.token, body: { ...base, categoryId: '0b3d961d-dcd0-4d72-9e21-11950764ad45' } });
check('catégorie inconnue refusée', r.status === 400, msg(r));
r = await call('POST', '/seller/products', { token: awa.token, body: { ...base, isFeatured: true } });
check('champ réservé à l’admin refusé (isFeatured)', r.status === 400, msg(r));
r = await call('POST', '/seller/products', { token: awa.token, body: { ...base, name: 'ab' } });
check('nom trop court refusé', r.status === 400, msg(r));

r = await call('POST', '/seller/products', { token: awa.token, body: { ...base, originalPrice: 5000, tags: ['Canva', 'canva', ' Boutique '] } });
check('brouillon créé', r.status === 201 && r.json.reviewStatus === 'draft' && r.json.isActive === false, r.json);
const p1 = r.json;
check('adresse sans accents', /^guide-d-ete-creer-sa-boutique/.test(p1.slug), p1.slug);
check('mots-clés dédoublonnés en minuscules', JSON.stringify(p1.tags) === '["canva","boutique"]', p1.tags);

r = await call('GET', `/seller/products/${p1.id}`, { token: noStore.token });
check('produit d’un autre vendeur : 404', r.status === 404, r.status);
r = await call('PATCH', `/seller/products/${p1.id}`, { token: noStore.token, body: { name: 'Piratage' } });
check('modification par un autre vendeur : 404', r.status === 404, r.status);
r = await call('GET', `/seller/products/${p1.id}`, { token: adminToken });
check('jeton admin refusé sur l’espace vendeur', r.status === 401, r.status);

r = await call('PATCH', `/seller/products/${p1.id}`, { token: awa.token, body: { name: 'Guide pratique : vendre en ligne' } });
check('renommage d’un brouillon : nouvelle adresse', r.status === 200 && r.json.slug.startsWith('guide-pratique-vendre-en-ligne'), r.json.slug);

section('Images');
r = await call('POST', `/seller/products/${p1.id}/cover`, { token: awa.token, form: formWith('file', [['faux.png', '<html><script>alert(1)</script></html>', 'image/png']]) });
check('fausse image (HTML nommé .png) refusée', r.status === 400, msg(r));
r = await call('POST', `/seller/products/${p1.id}/cover`, { token: awa.token, form: formWith('file', [['couverture.png', PNG, 'image/png']]) });
check('couverture enregistrée', r.status === 201 && !!r.json.coverUrl, r.json);
const coverRes = await fetch(r.json.coverUrl);
check('couverture servie en image/png', coverRes.status === 200 && coverRes.headers.get('content-type') === 'image/png', coverRes.headers.get('content-type'));
r = await call('POST', `/seller/products/${p1.id}/screenshots`, {
  token: awa.token,
  form: formWith('files', [['a.png', PNG, 'image/png'], ['b.png', PNG, 'image/png']]),
});
check('2 captures enregistrées', r.status === 201 && r.json.screenshotUrls.length === 2, r.json);
r = await call('POST', `/seller/products/${p1.id}/screenshots`, {
  token: awa.token,
  form: formWith('files', Array.from({ length: 9 }, (_, i) => [`${i}.png`, PNG, 'image/png'])),
});
check('9 captures refusées', r.status === 400, r);

section('Fichier et antivirus');
r = await call('POST', `/seller/products/${p1.id}/file`, { token: awa.token, form: formWith('file', [['page.html', '<script>x</script>', 'text/html']]) });
check('fichier .html refusé', r.status === 400 && /\.html non accepté/.test(msg(r)), msg(r));
r = await call('POST', `/seller/products/${p1.id}/file`, { token: awa.token, form: formWith('file', [['sans-extension', 'abc', 'application/octet-stream']]) });
check('fichier sans extension refusé', r.status === 400, msg(r));
r = await call('POST', `/seller/products/${p1.id}/file`, { token: awa.token, form: formWith('file', [['vide.pdf', '', 'application/pdf']]) });
check('fichier vide refusé', r.status === 400, msg(r));
r = await call('POST', `/seller/products/${p1.id}/file`, { token: awa.token, form: formWith('file', [['Guide d’été.pdf', PDF, 'application/pdf']]) });
check('fichier PDF reçu, analyse en attente', r.status === 201 && r.json.scanStatus === 'pending', r.json);
check('nom de fichier nettoyé', r.json.file?.name === 'Guide-d-ete.pdf', r.json.file);
r = await call('POST', `/seller/products/${p1.id}/submit`, { token: awa.token, body: { certifyRights: true } });
check('soumission pendant l’analyse refusée', r.status === 409 || r.status === 400, msg(r));
r = await waitScan(awa.token, p1.id);
check('fichier déclaré sain', r.json.scanStatus === 'clean', r.json.scanStatus);

section('Soumission');
r = await call('POST', `/seller/products/${p1.id}/submit`, { token: awa.token, body: {} });
check('sans certification des droits : 400', r.status === 400, msg(r));
r = await call('POST', `/seller/products/${p1.id}/submit`, { token: awa.token, body: { certifyRights: 'false' } });
check('certification « false » envoyée en texte : 400', r.status === 400, msg(r));
r = await call('POST', `/seller/products/${p1.id}/submit`, { token: awa.token, body: { certifyRights: true } });
check('description manquante signalée', r.status === 400 && /description/.test(msg(r)), msg(r));
const description = 'Un guide complet pour lancer sa boutique.\n\nAvec des exemples <script>alert("xss")</script> & des modèles.';
r = await call('PATCH', `/seller/products/${p1.id}`, { token: awa.token, body: { description } });
check('description enregistrée', r.status === 200, r);
r = await call('POST', `/seller/products/${p1.id}/submit`, { token: awa.token, body: { certifyRights: true } });
check('1er produit : en attente de validation', r.status === 201 && r.json.reviewStatus === 'pending', r.json);
r = await call('POST', `/seller/products/${p1.id}/submit`, { token: awa.token, body: { certifyRights: true } });
check('double soumission refusée', r.status === 409, msg(r));
r = await call('PATCH', `/seller/products/${p1.id}/visibility`, { token: awa.token, body: { isActive: true } });
check('affichage d’un produit non validé refusé', r.status === 409, msg(r));
const slug1 = (await call('GET', `/seller/products/${p1.id}`, { token: awa.token })).json.slug;
r = await call('GET', `/products/${slug1}`);
check('produit en attente invisible sur le site', r.status === 404, r.status);

section('Validation par l’admin');
r = await call('GET', '/admin/products/review', { token: adminToken });
const pending = Array.isArray(r.json) ? r.json.find((p) => p.id === p1.id) : null;
check('produit dans la file « en attente »', !!pending, r.json);
check('vendeur et boutique présentés', pending?.seller?.email === awa.email && pending?.store?.slug === `awa-${run}`, pending);
r = await call('GET', '/admin/products/review', { token: awa.token });
check('file de validation refusée à un vendeur', r.status === 401, r.status);
r = await call('GET', `/admin/products/${p1.id}/file-url`, { token: adminToken });
check('lien de téléchargement admin', r.status === 200 && !!r.json.url, r.json);
const dl = await fetch(r.json.url);
const dlBody = Buffer.from(await dl.arrayBuffer());
check('fichier téléchargé identique', dl.status === 200 && dlBody.equals(PDF), dl.status);
check('téléchargé en pièce jointe', /attachment/.test(dl.headers.get('content-disposition') ?? ''), dl.headers.get('content-disposition'));
r = await call('PATCH', `/admin/products/${p1.id}/review`, { token: adminToken, body: { decision: 'reject', note: 'non' } });
check('refus sans motif suffisant : 400', r.status === 400, msg(r));
r = await call('PATCH', `/admin/products/${p1.id}/review`, { token: adminToken, body: { decision: 'approve' } });
check('produit validé', r.status === 200 && r.json.reviewStatus === 'approved' && r.json.isActive === true, r.json);
await wait(800);
check('e-mail « produit validé » envoyé', (await mails(awa.email)).some((m) => /produit est validé/i.test(m.subject)));

r = await call('GET', `/products/${slug1}`);
check('vendeur encore en attente : produit invisible', r.status === 404, r.status);
r = await call('PATCH', `/admin/sellers/${awa.id}/status`, { token: adminToken, body: { status: 'approved' } });
check('vendeur validé', r.status === 200, r);
r = await call('GET', `/products/${slug1}`);
check('produit visible sur le site', r.status === 200, r.status);
check('« Vendu par » la boutique', r.json.store?.slug === `awa-${run}`, r.json.store);
check('description échappée (pas de HTML du vendeur)', !r.json.description.includes('<script>') && r.json.description.includes('&lt;script&gt;'), r.json.description);
check('paragraphes conservés', (r.json.description.match(/<p>/g) ?? []).length === 2, r.json.description);
r = await call('GET', '/products?limit=100');
check('produit dans le catalogue', r.json.data.some((p) => p.slug === slug1));
r = await call('GET', `/stores/awa-${run}`);
check('produit sur la page de la boutique', r.json.products?.some((p) => p.slug === slug1), r.json);
r = await call('PATCH', `/seller/products/${p1.id}`, { token: awa.token, body: { name: 'Guide pratique (édition 2)' } });
check('renommage après publication : adresse inchangée', r.status === 200 && r.json.slug === slug1, r.json.slug);

section('Produits suivants : publication directe');
r = await call('POST', '/seller/products', {
  token: awa.token,
  body: { name: 'Modèles gratuits', price: 0, categoryId, description: 'Dix modèles gratuits pour découvrir la boutique, à télécharger.' },
});
const p2 = r.json;
await call('POST', `/seller/products/${p2.id}/cover`, { token: awa.token, form: formWith('file', [['c.png', PNG, 'image/png']]) });
await call('POST', `/seller/products/${p2.id}/file`, { token: awa.token, form: formWith('file', [['modeles.zip', 'PK-faux-zip-sain', 'application/zip']]) });
await waitScan(awa.token, p2.id);
r = await call('POST', `/seller/products/${p2.id}/submit`, { token: awa.token, body: { certifyRights: true } });
check('2e produit publié sans validation', r.status === 201 && r.json.reviewStatus === 'approved' && r.json.isPublic === true, r.json);

section('Commande et téléchargement');
r = await call('POST', '/orders', {
  body: { customerName: 'Client Test', customerEmail: `client.${run}@test.local`, customerPhone: '699000002', items: [{ productId: p2.id, quantity: 1 }], acceptTerms: true },
});
check('commande gratuite créée', r.status === 201 && r.json.status === 'paid', r.json);
await wait(1200);
const clientMail = (await mails(`client.${run}@test.local`)).map((m) => m.body.match(/telechargement\/([0-9a-f-]{36})/)?.[1]).find(Boolean);
check('lien de téléchargement reçu', !!clientMail);
r = await call('GET', `/downloads/${clientMail}`, { redirect: 'manual' });
check('téléchargement redirigé vers le fichier', r.status === 302, r.status);

r = await call('POST', `/seller/products/${p2.id}/file`, { token: awa.token, form: formWith('file', [['eicar.zip', EICAR, 'application/zip']]) });
check('nouveau fichier en analyse', r.json.scanStatus === 'pending', r.json);
r = await call('GET', `/downloads/${clientMail}`, { redirect: 'manual' });
check('téléchargement bloqué pendant l’analyse', r.status === 409, r);
r = await waitScan(awa.token, p2.id);
check('menace détectée', r.json.scanStatus === 'infected' && r.json.scanThreat === 'Eicar-Signature' && r.json.file === null, r.json);
await wait(800);
check('e-mail « fichier refusé » envoyé', (await mails(awa.email)).some((m) => /antivirus/i.test(m.subject)));
r = await call('GET', `/products/${p2.slug}`);
check('produit infecté invisible', r.status === 404, r.status);
r = await call('GET', `/downloads/${clientMail}`, { redirect: 'manual' });
check('fichier infecté jamais servi', r.status === 404, r.status);
r = await call('POST', '/orders', {
  body: { customerName: 'Client Test', customerEmail: `client2.${run}@test.local`, customerPhone: '699000003', items: [{ productId: p2.id, quantity: 1 }], acceptTerms: true },
});
check('commande d’un produit invisible refusée', r.status === 409, r.status);
await call('POST', `/seller/products/${p2.id}/file`, { token: awa.token, form: formWith('file', [['modeles.zip', 'PK-version-saine', 'application/zip']]) });
r = await waitScan(awa.token, p2.id);
check('fichier sain renvoyé : produit de nouveau en ligne', r.json.scanStatus === 'clean' && r.json.isPublic, r.json);

section('Relance de l’analyse');
r = await call('POST', `/admin/products/${p2.id}/rescan`, { token: adminToken });
check('fichier déjà sain : relance refusée', r.status === 409, r.status);

section('Masquer, retirer, supprimer');
r = await call('PATCH', `/seller/products/${p1.id}/visibility`, { token: awa.token, body: { isActive: false } });
check('produit masqué par le vendeur', r.status === 200 && r.json.isActive === false, r.json);
r = await call('GET', `/products/${slug1}`);
check('produit masqué invisible', r.status === 404, r.status);
await call('PATCH', `/seller/products/${p1.id}/visibility`, { token: awa.token, body: { isActive: true } });
r = await call('GET', `/products/${slug1}`);
check('produit réaffiché', r.status === 200, r.status);

r = await call('PATCH', `/admin/products/${p1.id}/review`, { token: adminToken, body: { decision: 'reject', note: 'Couverture de mauvaise qualité' } });
check('retrait du site par l’admin', r.status === 200 && r.json.reviewStatus === 'rejected' && r.json.isActive === false, r.json);
await wait(800);
check('e-mail avec le motif', (await mails(awa.email)).some((m) => /modifié/i.test(m.subject) && m.body.includes('Couverture de mauvaise qualit')));
r = await call('GET', `/seller/products/${p1.id}`, { token: awa.token });
check('motif visible par le vendeur', r.json.reviewNote === 'Couverture de mauvaise qualité', r.json.reviewNote);
r = await call('POST', `/seller/products/${p1.id}/submit`, { token: awa.token, body: { certifyRights: true } });
check('produit retiré : repasse par l’admin', r.status === 201 && r.json.reviewStatus === 'pending', r.json);

r = await call('DELETE', `/seller/products/${p2.id}`, { token: awa.token });
check('produit commandé : suppression refusée', r.status === 409, msg(r));
r = await call('POST', '/seller/products', { token: awa.token, body: { name: 'Brouillon à jeter', price: 0, categoryId } });
await call('POST', `/seller/products/${r.json.id}/cover`, { token: awa.token, form: formWith('file', [['c.png', PNG, 'image/png']]) });
r = await call('DELETE', `/seller/products/${r.json.id}`, { token: awa.token });
check('brouillon supprimé', r.status === 200 && r.json.deleted === true, r);

section('Suspension du vendeur');
r = await call('PATCH', `/admin/sellers/${awa.id}/status`, { token: adminToken, body: { status: 'suspended' } });
check('vendeur suspendu', r.status === 200, r);
r = await call('GET', `/products/${p2.slug}`);
check('ses produits disparaissent du site', r.status === 404, r.status);
r = await call('GET', '/products?limit=100');
check('et du catalogue', !r.json.data.some((p) => p.id === p2.id));
r = await call('GET', '/seller/products', { token: awa.token });
check('son jeton est refusé', r.status === 401, r.status);
r = await call('GET', '/products?limit=100');
check('produits BlackStore toujours visibles', r.json.data.length >= 2, r.json.total);

console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko > 0 ? 1 : 0);
