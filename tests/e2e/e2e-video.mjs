// Essais de bout en bout : vidéo de présentation YouTube (façon Play Store) et champs de la fiche
// produit enfin enregistrés par l'admin. Usage : BS_ADMIN_PASSWORD=… node e2e-video.mjs
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
async function call(method, path, { body, token } = {}) {
  const headers = { 'X-Real-IP': '10.60.0.1' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
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
const WATCH = (id) => `https://www.youtube.com/watch?v=${id}`;

section('Préparation');
const admin = (await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: process.env.BS_ADMIN_PASSWORD } })).json.accessToken;
check('connexion admin', !!admin);
const categoryId = (await call('GET', '/categories')).json[0].id;

section('Fiche produit de BlackStore : tous les champs du formulaire sont enregistrés');
let r = await call('POST', '/products', {
  token: admin,
  body: {
    name: `Montage vidéo facile ${run}`,
    description: '<p>Un logiciel de montage simple pour débutants.</p>',
    price: 4000,
    categoryId,
    platform: 'desktop',
    shortDescription: '  Montez vos vidéos en 5 minutes  ',
    originalPrice: 6000,
    tags: ['Montage', 'vidéo', 'montage', ' '],
    installGuide: '<ol><li>Téléchargez</li><li>Installez</li></ol>',
    demoVideoUrl: 'https://youtu.be/dQw4w9WgXcQ?si=partage123',
    installVideoUrl: 'https://www.youtube.com/shorts/aBcDeFgHiJk',
    seoTitle: 'Montage vidéo facile — BlackStore',
    seoDescription: 'Le montage vidéo simple, payable en Mobile Money.',
  },
});
const created = r.json;
check('produit créé', r.status === 201 && !!created.id, r.json);
check('vidéo de présentation ramenée à la forme youtube.com/watch', created.demoVideoUrl === WATCH('dQw4w9WgXcQ'), created.demoVideoUrl);
check('Short YouTube accepté pour le guide', created.installVideoUrl === WATCH('aBcDeFgHiJk'), created.installVideoUrl);
check('accroche nettoyée, prix barré, tags dédoublonnés', created.shortDescription === 'Montez vos vidéos en 5 minutes' && created.originalPrice === 6000 && JSON.stringify(created.tags) === '["montage","vidéo"]', [created.shortDescription, created.originalPrice, created.tags]);
check('guide et SEO enregistrés', created.installGuide.includes('Installez') && created.seoTitle === 'Montage vidéo facile — BlackStore' && !!created.seoDescription, created);

const badLinks = [
  ['lien Vimeo', 'https://vimeo.com/123456789'],
  ['faux domaine youtube.com.exemple', 'https://www.youtube.com.exemple.net/watch?v=dQw4w9WgXcQ'],
  ['autre site avec ?v=', 'https://exemple.net/watch?v=dQw4w9WgXcQ'],
  ['lien javascript:', 'javascript:alert(1)'],
  ['identifiant trop court', 'https://youtu.be/abc'],
  ['texte libre', 'ma vidéo'],
];
for (const [label, url] of badLinks) {
  r = await call('PATCH', `/products/${created.id}`, { token: admin, body: { demoVideoUrl: url } });
  check(`refusé : ${label}`, r.status === 400 && /YouTube/.test(msg(r)), [r.status, msg(r)]);
}
r = await call('PATCH', `/products/${created.id}`, { token: admin, body: { demoVideoUrl: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL1' } });
check('lien mobile avec paramètres accepté', r.status === 200 && r.json.demoVideoUrl === WATCH('dQw4w9WgXcQ'), [r.status, r.json.demoVideoUrl]);
r = await call('PATCH', `/products/${created.id}`, { token: admin, body: { name: `Montage vidéo facile ${run}` } });
check('modification sans les champs : rien n’est effacé', r.json.demoVideoUrl === WATCH('dQw4w9WgXcQ') && r.json.originalPrice === 6000 && r.json.tags.length === 2, r.json);
r = await call('PATCH', `/products/${created.id}`, { token: admin, body: { installVideoUrl: '', seoTitle: '', originalPrice: null } });
check('champs vidés : vidéo du guide, titre SEO et prix barré effacés', r.status === 200 && r.json.installVideoUrl === null && r.json.seoTitle === null && r.json.originalPrice === null, r.json);
r = await call('PATCH', `/products/${created.id}`, { token: admin, body: { seoTitle: 'x'.repeat(71) } });
check('titre SEO de 71 caractères refusé', r.status === 400, [r.status, msg(r)]);

section('Fiche publique');
await call('PATCH', `/products/${created.id}`, { token: admin, body: { isActive: true, installVideoUrl: 'https://youtu.be/aBcDeFgHiJk' } });
r = await call('GET', `/products/${created.slug}`);
check('fiche en ligne avec la vidéo de présentation', r.status === 200 && r.json.demoVideoUrl === WATCH('dQw4w9WgXcQ'), [r.status, r.json.demoVideoUrl]);
check('vidéo du guide et accroche visibles', r.json.installVideoUrl === WATCH('aBcDeFgHiJk') && r.json.shortDescription === 'Montez vos vidéos en 5 minutes', r.json);
await call('PATCH', `/products/${created.id}`, { token: admin, body: { isActive: false } });

section('Produit de vendeur');
const email = `video.${run}@test.local`;
await call('POST', '/seller/auth/register', { body: { firstName: 'Aïcha', lastName: 'Bello', email, phone: '677334455', password: 'vendeur2026', acceptTerms: true } });
await wait(800);
const mails = await (await fetch(`http://localhost:8028/api/v2/search?kind=to&query=${encodeURIComponent(email)}`)).json();
const verify = mails.items.map((m) => decodeQP(m.Content.Body).match(/token=([a-f0-9]{64})/)?.[1]).find(Boolean);
await call('POST', '/seller/auth/verify-email', { body: { token: verify } });
const seller = (await call('POST', '/seller/auth/login', { body: { email, password: 'vendeur2026' } })).json.accessToken;
await call('PUT', '/seller/store', { token: seller, body: { name: `Studio Aïcha ${run}`, slug: `studio-aicha-${run}` } });
r = await call('POST', '/seller/products', {
  token: seller,
  body: { name: `Kit Canva animé ${run}`, price: 3000, categoryId, demoVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share' },
});
const sp = r.json;
check('brouillon créé avec sa vidéo', r.status === 201 && sp.demoVideoUrl === WATCH('dQw4w9WgXcQ'), [r.status, sp.demoVideoUrl, msg(r)]);
r = await call('PATCH', `/seller/products/${sp.id}`, { token: seller, body: { demoVideoUrl: 'https://www.tiktok.com/@moi/video/123' } });
check('lien TikTok refusé avec un message clair', r.status === 400 && msg(r) === 'Collez le lien d’une vidéo YouTube (youtube.com ou youtu.be)', [r.status, msg(r)]);
r = await call('PATCH', `/seller/products/${sp.id}`, { token: seller, body: { demoVideoUrl: 'https://youtu.be/aBcDeFgHiJk' } });
check('vidéo remplacée', r.status === 200 && r.json.demoVideoUrl === WATCH('aBcDeFgHiJk'), [r.status, r.json.demoVideoUrl]);
r = await call('GET', `/seller/products/${sp.id}`, { token: seller });
check('relue par le vendeur', r.json.demoVideoUrl === WATCH('aBcDeFgHiJk'), r.json.demoVideoUrl);
r = await call('GET', '/admin/products/review?status=draft', { token: admin });
const inReview = Array.isArray(r.json) ? r.json.find((p) => p.id === sp.id) : null;
check('visible par l’admin qui vérifie le produit', inReview?.demoVideoUrl === WATCH('aBcDeFgHiJk'), inReview ?? r.json);
r = await call('PATCH', `/seller/products/${sp.id}`, { token: seller, body: { demoVideoUrl: '' } });
check('vidéo retirée par le vendeur', r.status === 200 && r.json.demoVideoUrl === null, [r.status, r.json.demoVideoUrl]);
r = await call('PATCH', `/seller/products/${sp.id}`, { token: seller, body: { installVideoUrl: 'https://youtu.be/aBcDeFgHiJk' } });
check('le vendeur ne peut pas écrire les champs réservés à l’admin', r.status === 400, [r.status, msg(r)]);

console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko ? 1 : 0);
