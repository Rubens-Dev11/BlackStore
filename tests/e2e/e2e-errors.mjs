// Essais de bout en bout : erreurs claires. Messages de l'API en français (validation, routes,
// limites, Prisma, erreurs imprévues), états des liens de téléchargement et redirection des
// navigateurs vers la page explicative, pages d'erreur de la boutique.
// Usage : BS_ADMIN_PASSWORD=… BS_PG_PASS=… [STOREFRONT=http://localhost:3001] node e2e-errors.mjs
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { randomUUID } from 'crypto';

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
const sql = (query) =>
  execSync(`docker exec -e PGPASSWORD=${process.env.BS_PG_PASS} bs-test-postgres psql -U bstest -d bstest -tAc "${query.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
  }).trim();
async function call(method, path, { body, raw, token, form, ip = '10.63.0.1', accept, redirect } = {}) {
  const headers = { 'X-Real-IP': ip };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
  if (accept) headers.Accept = accept;
  const res = await fetch(API + path, { method, headers, body: form ?? raw ?? (body !== undefined ? JSON.stringify(body) : undefined), redirect });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
}
const msg = (r) => (Array.isArray(r.json?.message) ? r.json.message.join(' | ') : r.json?.message);
const english = /\b(must|should|property|Cannot|Unauthorized|Forbidden|Internal server)\b/;
const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

section('Messages de l’API en français');
let r = await call('GET', '/nexiste-pas');
check('adresse inconnue : 404 en français', r.status === 404 && r.json.message === 'Adresse introuvable : GET /nexiste-pas', r.json);
r = await call('GET', '/admin/legal-info');
check('route admin sans connexion : 401 en français', r.status === 401 && /^Connectez-vous/.test(msg(r)), r.json);
r = await call('POST', '/orders', { body: { customerName: 'A', customerEmail: 'x', items: [{ productId: 'p', quantity: 0 }], acceptTerms: true, pirate: 1 } });
const orderMessages = Array.isArray(r.json.message) ? r.json.message : [];
check('validation : forme habituelle (400, liste)', r.status === 400 && orderMessages.length >= 4 && r.json.error === 'Bad Request', r.json);
check('validation : aucun message anglais', orderMessages.every((m) => !english.test(m)), orderMessages);
check('champ inconnu refusé en français', orderMessages.includes('Le champ « pirate » n’est pas accepté.'.replace('’', "'")), orderMessages);
check('e-mail invalide expliqué', orderMessages.includes('Le champ « e-mail » doit contenir une adresse e-mail valide.'), orderMessages);
check('longueur minimale avec le nombre', orderMessages.includes('Le champ « nom » doit contenir au moins 2 caractères.'), orderMessages);
check('article imbriqué (quantité) expliqué', orderMessages.includes('Le champ « quantité » doit être supérieur ou égal à 1.'), orderMessages);
r = await call('POST', '/orders', { body: { customerName: 'Awa', customerEmail: 'awa@test.local', items: [] } });
check('message déjà en français conservé', r.status === 400 && msg(r).includes('Acceptez les conditions générales de vente'), r.json);
r = await call('POST', '/contact', { raw: '{"topic": "order", ' });
check('JSON mal formé : 400 en français', r.status === 400 && r.json.message === 'Requête invalide : le contenu envoyé est mal formé.', r.json);
r = await call('POST', '/contact', { body: { topic: 'order', name: 'Gros', email: 'gros@test.local', message: 'x'.repeat(150_000) }, ip: '10.63.0.2' });
check('contenu trop gros : 413 en français', r.status === 413 && r.json.message === 'Contenu trop volumineux.', [r.status, r.json]);
r = await call('POST', '/payments/initiate', { body: {} });
check('paiement sans commande : 400 au lieu de 500', r.status === 400 && /^Requête invalide/.test(msg(r)), [r.status, r.json]);
const admin = (await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: process.env.BS_ADMIN_PASSWORD } })).json.accessToken;
check('connexion admin', !!admin);
r = await call('PATCH', '/admin/reports/pas-un-identifiant', { token: admin, body: { action: 'dismiss' } });
check('identifiant mal formé : « Identifiant invalide. »', r.status === 400 && r.json.message === 'Identifiant invalide.', r.json);
const ip = `10.63.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
for (let i = 0; i < 5; i++) await call('POST', '/reports', { body: {}, ip });
r = await call('POST', '/reports', { body: {}, ip });
check('trop de tentatives : 429 en français', r.status === 429 && r.json.message === 'Trop de tentatives. Patientez quelques minutes avant de réessayer.', [r.status, r.json]);

section('Traduction des messages de validation (unitaire)');
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { frenchValidationMessages } = requireApi('./dist/src/common/errors/validation-messages.js');
const translated = frenchValidationMessages([
  { property: 'password', constraints: { minLength: 'password must be longer than or equal to 8 characters' } },
  { property: 'platform', constraints: { isIn: 'platform must be one of the following values: android, desktop' } },
  { property: 'email', constraints: { isEmail: 'Adresse e-mail invalide' } },
  { property: 'tags', constraints: { arrayMaxSize: 'tags must contain no more than 10 elements' } },
  { property: 'price', constraints: { max: 'price must not be greater than 1000000' } },
  { property: 'bizarre', constraints: { customRule: 'bizarre must be cool' } },
]);
check('longueur minimale', translated[0] === 'Le champ « mot de passe » doit contenir au moins 8 caractères.', translated[0]);
check('liste de valeurs permises', translated[1] === 'Le champ « plateforme » n’accepte que ces valeurs : android, desktop.'.replace('’', "'"), translated[1]);
check('message personnalisé gardé', translated[2] === 'Adresse e-mail invalide', translated[2]);
check('taille de liste', translated[3] === 'Le champ « mots-clés » contient trop d’éléments (10 au maximum).'.replace('’', "'"), translated[3]);
check('valeur maximale', translated[4] === 'Le champ « prix » doit être inférieur ou égal à 1000000.', translated[4]);
check('règle inconnue : message générique', translated[5] === 'Le champ « bizarre » n’est pas valide.'.replace('’', "'"), translated[5]);

section('Filtre d’erreurs (unitaire)');
const { AllExceptionsFilter } = requireApi('./dist/src/common/errors/all-exceptions.filter.js');
const { ForbiddenException } = requireApi('@nestjs/common');
const { Prisma } = requireApi('@prisma/client');
const replies = [];
const adapter = { reply: (_res, body, status) => replies.push({ body, status }), isHeadersSent: (res) => res.headersSent, end: (res) => (res.ended = true) };
const filter = new AllExceptionsFilter({ httpAdapter: adapter });
const host = (res = { headersSent: false }) => ({ switchToHttp: () => ({ getRequest: () => ({ method: 'GET', originalUrl: '/essai' }), getResponse: () => res }) });
filter.catch(new Error('panne imprévue (essai)'), host());
const crash = replies.pop();
check(
  'erreur imprévue : 500 avec une référence',
  crash.status === 500 && /^[0-9A-F]{8}$/.test(crash.body.reference) && crash.body.message.includes(crash.body.reference) && !crash.body.message.includes('panne'),
  crash,
);
filter.catch(new ForbiddenException(), host());
check('refus sans message : texte français', replies.pop().body.message === 'Vous n’avez pas accès à cette action.'.replace('’', "'"));
filter.catch(new Prisma.PrismaClientKnownRequestError('Record to update not found.', { code: 'P2025', clientVersion: '5' }), host());
const missing = replies.pop();
check('élément supprimé entre-temps (Prisma P2025) : 404', missing.status === 404 && /^Élément introuvable/.test(missing.body.message), missing);
filter.catch(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5' }), host());
check('doublon (Prisma P2002) : 409', replies.pop().status === 409);
const started = { headersSent: true };
filter.catch(new Error('coupure pendant un envoi'), host(started));
check('réponse déjà commencée : simplement close', started.ended === true && replies.length === 0);

section('Liens de téléchargement : états et page explicative');
const categoryId = (await call('GET', '/categories')).json[0].id;
const free = (await call('POST', '/products', { token: admin, body: { name: `Guide erreurs ${run}`, description: 'Un guide gratuit pour tester les liens.', price: 0, categoryId } })).json;
const upload = new FormData();
upload.append('file', new Blob(['%PDF-1.4 guide'], { type: 'application/pdf' }), 'guide.pdf');
await call('POST', `/products/${free.id}/upload`, { token: admin, form: upload });
await call('PATCH', `/products/${free.id}`, { token: admin, body: { isActive: true } });
r = await call('POST', '/orders', { body: { customerName: 'Awa Client', customerEmail: `erreurs.${run}@test.local`, items: [{ productId: free.id, quantity: 1 }], acceptTerms: true } });
check('commande gratuite payée d’office', r.status === 201 && r.json.status === 'paid', [r.status, msg(r)]);
const order = r.json;
const token = sql(`select dt.token from download_tokens dt join order_items oi on oi.id = dt.order_item_id where oi.order_id = '${order.id}'`);
const page = `${STOREFRONT}/telechargement/${token}`;

r = await call('GET', `/downloads/${token}/etat`);
check(
  'état « valide » avec produit, commande et compteur',
  r.status === 200 && r.json.etat === 'valide' && r.json.produit === free.name && r.json.commande === order.orderNumber && r.json.telechargementsRestants === 3 && r.json.telechargementsMax === 3 && !!r.json.expireLe,
  r.json,
);
check('état jamais mis en cache', r.headers.get('cache-control') === 'no-store', r.headers.get('cache-control'));
check('consulter l’état ne compte pas de téléchargement', sql(`select download_count from download_tokens where token = '${token}'`) === '0');
r = await call('GET', `/downloads/${token}`, { accept: BROWSER, redirect: 'manual' });
check('navigateur, lien valable : fichier envoyé (302)', r.status === 302 && /localhost:9010/.test(r.headers.get('location') ?? ''), [r.status, r.headers.get('location')]);
await call('GET', `/downloads/${token}`, { redirect: 'manual' });
await call('GET', `/downloads/${token}`, { redirect: 'manual' });
r = await call('GET', `/downloads/${token}`, { redirect: 'manual' });
check('appel technique, quota atteint : 403 JSON', r.status === 403 && msg(r) === 'Quota de téléchargements atteint', [r.status, r.json]);
r = await call('GET', `/downloads/${token}`, { accept: BROWSER, redirect: 'manual' });
check('navigateur, quota atteint : renvoyé vers la page explicative (303)', r.status === 303 && r.headers.get('location') === page, [r.status, r.headers.get('location')]);
r = await call('GET', `/downloads/${token}/etat`);
check('état « quota »', r.json.etat === 'quota' && r.json.telechargementsRestants === 0, r.json);

r = await call('POST', `/orders/${order.id}/resend-download`, { token: admin });
check('l’admin renvoie les liens', r.status === 201 || r.status === 200, [r.status, r.json]);
r = await call('GET', `/downloads/${token}/etat`);
check('le même lien remarche avec 3 téléchargements', r.json.etat === 'valide' && r.json.telechargementsRestants === 3, r.json);

sql(`update download_tokens set expires_at = now() - interval '1 hour' where token = '${token}'`);
r = await call('GET', `/downloads/${token}/etat`);
check('état « expire »', r.json.etat === 'expire', r.json);
r = await call('GET', `/downloads/${token}`, { accept: BROWSER, redirect: 'manual' });
check('navigateur, lien expiré : page explicative', r.status === 303 && r.headers.get('location') === page, [r.status, r.headers.get('location')]);
r = await call('GET', `/downloads/${token}`, { redirect: 'manual' });
check('appel technique, lien expiré : 410 JSON', r.status === 410 && msg(r) === 'Lien expiré', [r.status, r.json]);
sql(`update download_tokens set expires_at = now() + interval '72 hours' where token = '${token}'`);

const filePath = sql(`select file_path from products where id = '${free.id}'`);
sql(`update products set file_path = null where id = '${free.id}'`);
r = await call('GET', `/downloads/${token}/etat`);
check('état « indisponible » (fichier absent)', r.json.etat === 'indisponible', r.json);
r = await call('GET', `/downloads/${token}`, { redirect: 'manual' });
check('appel technique, fichier absent : 404 JSON', r.status === 404 && msg(r) === 'Fichier indisponible', [r.status, r.json]);
sql(`update products set file_path = '${filePath}' where id = '${free.id}'`);

const unknown = randomUUID();
r = await call('GET', `/downloads/${unknown}/etat`);
check('lien inconnu : état « introuvable », sans détail', r.status === 200 && r.json.etat === 'introuvable' && !('produit' in r.json), r.json);
r = await call('GET', `/downloads/${unknown}`, { accept: BROWSER, redirect: 'manual' });
check('navigateur, lien inconnu : page explicative', r.status === 303 && r.headers.get('location') === `${STOREFRONT}/telechargement/${unknown}`, [r.status, r.headers.get('location')]);
r = await call('GET', `/downloads/${'x'.repeat(300)}/etat`);
check('valeur absurde : « introuvable » sans erreur', r.status === 200 && r.json.etat === 'introuvable', r.json);

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
  let p = await html(`/telechargement/${token}`);
  check('page « Votre fichier est prêt » avec le bouton', p.status === 200 && p.text.includes('Votre fichier est prêt') && p.text.includes(`href="${API}/downloads/${token}"`), p.status);
  check('page non indexée et sans référent', p.text.includes('name="robots" content="noindex, nofollow"') && p.text.includes('name="referrer" content="no-referrer"'));
  check('détails : produit, commande, téléchargements restants', p.text.includes(free.name) && p.text.includes(order.orderNumber) && p.text.includes('3 sur 3'));
  for (let i = 0; i < 3; i++) await call('GET', `/downloads/${token}`, { redirect: 'manual' });
  p = await html(`/telechargement/${token}`);
  check('quota : explication et demande de nouveau lien préremplie', p.text.includes('Tous les téléchargements de ce lien ont été utilisés') && p.text.includes(`/contact?sujet=order&commande=${order.orderNumber}`));
  sql(`update download_tokens set expires_at = now() - interval '1 hour' where token = '${token}'`);
  p = await html(`/telechargement/${token}`);
  check('expiré : explication et date d’expiration', p.text.includes('Ce lien de téléchargement a expiré') && p.text.includes('Expiré le'));
  p = await html(`/telechargement/${unknown}`);
  check('inconnu : explication', p.text.includes('Ce lien de téléchargement n\'existe pas'));
  await call('PATCH', `/orders/${order.id}/refund`, { token: admin });
  p = await html(`/telechargement/${token}`);
  check('remboursé : lien désactivé expliqué', p.text.includes('Ce lien n\'est plus valable') && p.text.includes('remboursée ou annulée'));
  p = await html(`/contact?sujet=order&commande=${order.orderNumber}`);
  check('formulaire de contact prérempli avec la commande', p.text.includes(`value="${order.orderNumber}"`));
  p = await html('/produits/produit-qui-n-existe-pas');
  check('produit inconnu : 404 « Ce produit n’est plus disponible »', p.status === 404 && p.text.includes('Ce produit n\'est plus disponible'), p.status);
  p = await html('/boutique/boutique-qui-n-existe-pas');
  check('boutique inconnue : 404 « Cette boutique n’est pas en ligne »', p.status === 404 && p.text.includes('Cette boutique n\'est pas en ligne'), p.status);
  p = await html('/une-page-qui-n-existe-pas');
  check('adresse inconnue : 404 « Page introuvable »', p.status === 404 && p.text.includes('Page introuvable') && p.text.includes('Erreur 404'), p.status);
  const slug = sql(`select slug from products where id = '${free.id}'`);
  p = await html(`/produits/${slug}`);
  check('produit existant toujours affiché', p.status === 200 && p.text.includes(free.name), p.status);
}

console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko ? 1 : 0);
