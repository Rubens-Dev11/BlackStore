// Test de bout en bout des boutiques vendeurs, contre l'API de test locale.
import { execSync } from 'node:child_process';

const API = 'http://localhost:3100';
const MAILHOG = 'http://localhost:8028';
const ADMIN_PASSWORD = process.env.BS_ADMIN_PASSWORD;

let ok = 0;
let ko = 0;
const check = (label, cond, detail = '') => {
  if (cond) { ok++; console.log(`  ✓ ${label}`); }
  else { ko++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
};
const section = (title) => console.log(`\n${title}`);

let ip = 0;
async function call(method, path, { body, token, form } = {}) {
  const headers = { 'X-Real-IP': `10.7.0.${++ip}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

const decodeQP = (s) => { const soft = s.replace(/=\r?\n/g, ''); const b = []; for (let i = 0; i < soft.length; i++) { const h = soft.slice(i + 1, i + 3); if (soft[i] === '=' && /^[0-9A-F]{2}$/i.test(h)) { b.push(parseInt(h, 16)); i += 2; } else b.push(...Buffer.from(soft[i], 'utf8')); } return Buffer.from(b).toString('utf8'); };
async function verificationToken(email) {
  for (let i = 0; i < 20; i++) {
    const data = await (await fetch(`${MAILHOG}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`)).json();
    const token = data.items?.[0] && decodeQP(data.items[0].Content.Body).match(/token=([a-f0-9]{64})/)?.[1];
    if (token) return token;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/** Inscrit, confirme et connecte un vendeur ; renvoie son jeton d'accès. */
async function newSeller(tag) {
  const email = `${tag}.${Date.now()}@test.local`;
  await call('POST', '/seller/auth/register', { body: { firstName: 'Awa', lastName: 'Test', email, phone: '699000001', password: 'vendeur2026', acceptTerms: true } });
  await call('POST', '/seller/auth/verify-email', { body: { token: await verificationToken(email) } });
  const r = await call('POST', '/seller/auth/login', { body: { email, password: 'vendeur2026' } });
  return { email, token: r.json.accessToken };
}

const sql = (query) =>
  execSync(`docker exec bs-test-postgres psql -U bstest -d bstest -tAc "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const logoForm = (buffer, type = 'image/png', name = 'logo.png') => {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type }), name);
  return form;
};

const slug = `awa-digital-${Date.now().toString(36)}`;
const store = {
  name: 'Awa Digital',
  slug,
  description: 'Modèles et e-books pour entrepreneurs.',
  facebookUrl: 'https://www.facebook.com/awadigital',
  instagramUrl: 'https://instagram.com/awadigital',
  tiktokUrl: '',
  whatsapp: '6 99 11 22 33',
};

section('1. Création de la boutique');
const seller = await newSeller('boutique');
check('vendeur de test connecté', !!seller.token);
let r = await call('GET', '/seller/store', { token: seller.token });
check('pas encore de boutique : { store: null }', r.status === 200 && r.json.store === null, JSON.stringify(r.json));
r = await call('PUT', '/seller/store', { token: seller.token, body: { ...store, slug: 'Awa Digital!' } });
check('adresse avec majuscules et espaces refusée (400)', r.status === 400, `${r.status}`);
r = await call('PUT', '/seller/store', { token: seller.token, body: { ...store, slug: 'blackstore' } });
check('adresse réservée « blackstore » refusée (400)', r.status === 400 && JSON.stringify(r.json).includes('réservée'), JSON.stringify(r.json));
r = await call('PUT', '/seller/store', { token: seller.token, body: { ...store, facebookUrl: 'https://facebook.com.arnaque.cm/page' } });
check('faux lien Facebook refusé (400)', r.status === 400, `${r.status}`);
r = await call('PUT', '/seller/store', { token: seller.token, body: { ...store, instagramUrl: 'http://instagram.com/awa' } });
check('lien non sécurisé (http) refusé (400)', r.status === 400, `${r.status}`);
r = await call('PUT', '/seller/store', { token: seller.token, body: store });
check('boutique créée (200)', r.status === 200 && r.json.slug === slug, JSON.stringify(r.json));
check('lien public construit : http://localhost:3001/boutique/…', r.json.publicUrl === `http://localhost:3001/boutique/${slug}`, r.json.publicUrl);
check('WhatsApp normalisé en +237699112233', r.json.whatsapp === '+237699112233', r.json.whatsapp);
check('lien TikTok vide enregistré comme absent', r.json.tiktokUrl === null, String(r.json.tiktokUrl));
check('aucune clé de stockage exposée', !('logoKey' in r.json));
const storeId = r.json.id;

section('2. Unicité de l’adresse');
const other = await newSeller('autre');
r = await call('PUT', '/seller/store', { token: other.token, body: { ...store, name: 'Copie' } });
check('même adresse pour un autre vendeur refusée (409)', r.status === 409, JSON.stringify(r.json));
r = await call('PUT', '/seller/store', { token: seller.token, body: { ...store, name: 'Awa Digital Pro' } });
check('le propriétaire garde son adresse en modifiant sa boutique (200)', r.status === 200 && r.json.name === 'Awa Digital Pro', `${r.status}`);
check('modification sans création d’une 2e boutique', sql(`SELECT count(*) FROM stores WHERE seller_id = '${r.json.sellerId}'`) === '1');

section('3. Logo');
r = await call('POST', '/seller/store/logo', { token: seller.token, form: logoForm(Buffer.from('<html>pas une image</html>'), 'image/png') });
check('faux fichier image refusé, malgré son type annoncé (400)', r.status === 400, JSON.stringify(r.json));
r = await call('POST', '/seller/store/logo', { token: seller.token, form: logoForm(Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)])) });
check('logo de plus de 2 Mo refusé (413)', r.status === 413, `${r.status}`);
r = await call('POST', '/seller/store/logo', { token: other.token, form: logoForm(PNG) });
check('logo sans boutique refusé (404)', r.status === 404, `${r.status}`);
r = await call('POST', '/seller/store/logo', { token: seller.token, form: logoForm(PNG) });
check('vrai logo accepté (201), adresse signée fournie', r.status === 201 && /^http:\/\/localhost:9010\/bs-test\/stores\//.test(r.json.logoUrl ?? ''), r.json.logoUrl);
const firstKey = sql(`SELECT logo_key FROM stores WHERE id = '${storeId}'`);
r = await call('POST', '/seller/store/logo', { token: seller.token, form: logoForm(PNG) });
const secondKey = sql(`SELECT logo_key FROM stores WHERE id = '${storeId}'`);
check('nouveau logo : nouvelle clé de stockage', r.status === 201 && firstKey !== secondKey);
const logoResponse = await fetch(r.json.logoUrl);
check('le logo est téléchargeable (200, image/png)', logoResponse.status === 200 && logoResponse.headers.get('content-type') === 'image/png', `${logoResponse.status} ${logoResponse.headers.get('content-type')}`);

section('4. Page publique');
r = await call('GET', `/stores/${slug}`);
check('vendeur en attente : boutique invisible (404)', r.status === 404, `${r.status}`);
const admin = await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: ADMIN_PASSWORD } });
const adminToken = admin.json.accessToken;
const sellerId = sql(`SELECT seller_id FROM stores WHERE id = '${storeId}'`);
await call('PATCH', `/admin/sellers/${sellerId}/status`, { token: adminToken, body: { status: 'approved' } });
r = await call('GET', `/stores/${slug}`);
check('vendeur validé : boutique visible (200)', r.status === 200 && r.json.name === 'Awa Digital Pro', `${r.status}`);
check('aucun produit pour le moment', Array.isArray(r.json.products) && r.json.products.length === 0);
const publicJson = JSON.stringify(r.json);
check('aucune donnée personnelle du vendeur (e-mail, téléphone, identifiant)', !publicJson.includes(seller.email) && !publicJson.includes('699000001') && !publicJson.includes(sellerId));
r = await call('GET', '/stores/inconnue-xyz');
check('boutique inconnue (404)', r.status === 404, `${r.status}`);
r = await call('GET', '/stores/..%2F..%2Fadmin');
check('adresse malformée (404)', r.status === 404, `${r.status}`);

section('5. Produits et « Vendu par »');
const productSlug = sql("SELECT slug FROM products ORDER BY created_at LIMIT 1");
sql(`UPDATE products SET store_id = '${storeId}', is_active = true, scan_status = 'clean' WHERE slug = '${productSlug}'`);
r = await call('GET', `/stores/${slug}`);
check('le produit rattaché apparaît dans la boutique', r.json.products?.length === 1 && r.json.products[0].slug === productSlug, JSON.stringify(r.json.products?.map((p) => p.slug)));
check('format catalogue (downloadCount présent, pas de _count)', r.json.products?.[0] && 'downloadCount' in r.json.products[0] && !('_count' in r.json.products[0]));
r = await call('GET', `/products/${productSlug}`);
check('fiche produit : « Vendu par » la boutique', r.json.store?.slug === slug && r.json.store?.name === 'Awa Digital Pro', JSON.stringify(r.json.store));
const blackstoreSlug = sql("SELECT slug FROM products WHERE store_id IS NULL ORDER BY created_at LIMIT 1");
sql(`UPDATE products SET is_active = true WHERE slug = '${blackstoreSlug}'`);
r = await call('GET', `/products/${blackstoreSlug}`);
check('produit BlackStore : pas de boutique (store null)', r.status === 200 && r.json.store === null, JSON.stringify(r.json.store));

section('6. Suspension et administration');
r = await call('GET', '/admin/sellers', { token: adminToken });
const listed = r.json.find?.((s) => s.id === sellerId);
check('la liste admin indique la boutique du vendeur', listed?.store?.slug === slug, JSON.stringify(listed?.store));
await call('PATCH', `/admin/sellers/${sellerId}/status`, { token: adminToken, body: { status: 'suspended' } });
r = await call('GET', `/stores/${slug}`);
check('vendeur suspendu : boutique de nouveau invisible (404)', r.status === 404, `${r.status}`);
r = await call('GET', '/seller/store');
check('espace boutique sans connexion refusé (401)', r.status === 401, `${r.status}`);
r = await call('GET', '/seller/store', { token: adminToken });
check('jeton admin refusé sur l’espace boutique (401)', r.status === 401, `${r.status}`);

console.log(`\nRésultat : ${ok} réussis, ${ko} échoués`);
process.exit(ko === 0 ? 0 : 1);
