// Essais de bout en bout de la vérification d'identité contre l'API de test (port 3100).
// Usage : BS_ADMIN_PASSWORD=… node e2e-identity.mjs
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

async function call(method, path, { body, token, form } = {}) {
  const headers = { 'X-Real-IP': '10.40.0.1' };
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
async function newSeller(label) {
  const email = `${label}.${run}@test.local`;
  await call('POST', '/seller/auth/register', { body: { firstName: 'Aïcha', lastName: 'Mballa', email, phone: '699000021', password: 'vendeur2026', acceptTerms: true } });
  await wait(800);
  const token = (await mails(email)).map((m) => m.body.match(/token=([a-f0-9]{64})/)?.[1]).find(Boolean);
  await call('POST', '/seller/auth/verify-email', { body: { token } });
  const login = await call('POST', '/seller/auth/login', { body: { email, password: 'vendeur2026' } });
  return { email, token: login.json.accessToken };
}

// Trois PNG différents (1 px) : recto, verso, selfie.
const png = (b64) => Buffer.from(b64, 'base64');
const FRONT = png('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
const BACK = png('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
const SELFIE = png('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
function identityForm({ documentType = 'cni', fullName = 'Aïcha Mballa', consent = 'true', front = FRONT, back = BACK, selfie = SELFIE } = {}) {
  const form = new FormData();
  if (documentType !== null) form.append('documentType', documentType);
  if (fullName !== null) form.append('fullName', fullName);
  if (consent !== null) form.append('consent', consent);
  if (front) form.append('documentFront', new Blob([front], { type: 'image/png' }), 'recto.png');
  if (back) form.append('documentBack', new Blob([back], { type: 'image/png' }), 'verso.png');
  if (selfie) form.append('selfie', new Blob([selfie], { type: 'image/png' }), 'selfie.png');
  return form;
}

section('Préparation');
const adminToken = (await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: process.env.BS_ADMIN_PASSWORD } })).json.accessToken;
check('connexion admin', !!adminToken);
const aicha = await newSeller('aicha');
const other = await newSeller('autre');
check('vendeurs de test connectés', !!aicha.token && !!other.token);

section('Envoi par le vendeur');
let r = await call('GET', '/seller/identity', { token: aicha.token });
check('aucune vérification au départ', r.status === 200 && r.json.status === 'none', r.json);
r = await call('GET', '/seller/identity', { token: adminToken });
check('jeton admin refusé côté vendeur', r.status === 401, r.status);
r = await call('POST', '/seller/identity', { token: aicha.token, form: identityForm({ selfie: null }) });
check('sans selfie : 400', r.status === 400 && /selfie/.test(msg(r)), msg(r));
r = await call('POST', '/seller/identity', { token: aicha.token, form: identityForm({ back: null }) });
check('CNI sans verso : 400', r.status === 400 && /verso/.test(msg(r)), msg(r));
r = await call('POST', '/seller/identity', { token: aicha.token, form: identityForm({ front: Buffer.from('<html>faux</html>') }) });
check('fausse image refusée', r.status === 400 && /JPG, PNG ou WebP/.test(msg(r)), msg(r));
r = await call('POST', '/seller/identity', { token: aicha.token, form: identityForm({ fullName: 'Ai' }) });
check('nom trop court : 400', r.status === 400, msg(r));
r = await call('POST', '/seller/identity', { token: aicha.token, form: identityForm({ consent: 'false' }) });
check('sans accord : 400', r.status === 400 && /accepter/.test(msg(r)), msg(r));
r = await call('POST', '/seller/identity', { token: aicha.token, form: identityForm({ documentType: 'permis' }) });
check('type de pièce inconnu : 400', r.status === 400, msg(r));
r = await call('POST', '/seller/identity', { token: aicha.token, form: identityForm({ front: Buffer.concat([FRONT, Buffer.alloc(9 * 1024 * 1024)]) }) });
check('photo de plus de 8 Mo : 413', r.status === 413, r.status);
r = await call('POST', '/seller/identity', { token: aicha.token, form: identityForm() });
check('documents envoyés : en attente', r.status === 201 && r.json.status === 'pending' && r.json.documentType === 'cni', r.json);
r = await call('POST', '/seller/identity', { token: aicha.token, form: identityForm() });
check('second envoi pendant la vérification : 409', r.status === 409, msg(r));
r = await call('GET', '/seller/identity', { token: other.token });
check('un autre vendeur ne voit rien', r.json.status === 'none', r.json);
check('aucune photo renvoyée au vendeur', !JSON.stringify((await call('GET', '/seller/identity', { token: aicha.token })).json).includes('http'));

section('Contrôle par l’admin');
r = await call('GET', '/admin/identity-checks', { token: aicha.token });
check('file refusée à un vendeur', r.status === 401, r.status);
r = await call('GET', '/admin/identity-checks', { token: adminToken });
const pending = r.json.find((c) => c.seller.email === aicha.email);
check('vérification dans la file', !!pending, r.json);
check('nom déclaré et vendeur présentés', pending?.fullName === 'Aïcha Mballa' && pending?.seller.phone === '+237699000021', pending);
const urls = pending ? [pending.images.documentFrontUrl, pending.images.documentBackUrl, pending.images.selfieUrl] : [];
const contents = [FRONT, BACK, SELFIE];
let allServed = urls.length === 3;
let noStore = true;
for (const [i, url] of urls.entries()) {
  const res = await fetch(url);
  const body = Buffer.from(await res.arrayBuffer());
  allServed &&= res.status === 200 && res.headers.get('content-type') === 'image/png' && body.equals(contents[i]);
  noStore &&= res.headers.get('cache-control') === 'no-store';
}
check('les 3 photos s’ouvrent par lien signé', allServed);
check('photos jamais mises en cache', noStore);
const anonymous = await fetch(urls[0].split('?')[0]);
check('photo inaccessible sans signature', anonymous.status === 403, anonymous.status);
r = await call('GET', '/admin/sellers', { token: adminToken });
check('liste des vendeurs : identité « en attente »', r.json.find((s) => s.email === aicha.email)?.identityChecks?.[0]?.status === 'pending');

r = await call('PATCH', `/admin/identity-checks/${pending.id}`, { token: adminToken, body: { decision: 'reject' } });
check('refus sans motif : 400', r.status === 400, msg(r));
r = await call('PATCH', `/admin/identity-checks/${pending.id}`, { token: adminToken, body: { decision: 'reject', note: 'Photo floue ou illisible' } });
check('vérification refusée', r.status === 200 && r.json.status === 'rejected' && r.json.images.documentFrontUrl === null, r.json);
const gone = await fetch(urls[0]);
check('photos effacées du stockage', gone.status === 404, gone.status);
await wait(800);
check('e-mail au vendeur avec le motif', (await mails(aicha.email)).some((m) => /refaire/.test(m.subject) && m.body.includes('Photo floue')));
r = await call('GET', '/seller/identity', { token: aicha.token });
check('le vendeur voit le refus et le motif', r.json.status === 'rejected' && r.json.reviewNote === 'Photo floue ou illisible', r.json);
r = await call('PATCH', `/admin/identity-checks/${pending.id}`, { token: adminToken, body: { decision: 'approve' } });
check('décision déjà prise : 409', r.status === 409, r.status);

section('Nouvel envoi et validation');
r = await call('POST', '/seller/identity', { token: aicha.token, form: identityForm({ documentType: 'passport', back: null }) });
check('passeport (sans verso) envoyé', r.status === 201 && r.json.status === 'pending' && r.json.documentType === 'passport', r.json);
const second = (await call('GET', '/admin/identity-checks', { token: adminToken })).json.find((c) => c.seller.email === aicha.email);
check('passeport : pas de verso', second?.images.documentBackUrl === null && !!second?.images.selfieUrl, second?.images);
r = await call('PATCH', `/admin/identity-checks/${second.id}`, { token: adminToken, body: { decision: 'approve' } });
check('identité validée', r.status === 200 && r.json.status === 'approved', r.json);
await wait(800);
check('e-mail « identité vérifiée »', (await mails(aicha.email)).some((m) => /identité est vérifiée/.test(m.subject)));
r = await call('GET', '/seller/identity', { token: aicha.token });
check('le vendeur voit son identité vérifiée', r.json.status === 'approved' && !!r.json.reviewedAt, r.json);
r = await call('POST', '/seller/identity', { token: aicha.token, form: identityForm() });
check('nouvel envoi après validation : 409', r.status === 409, msg(r));
r = await call('GET', '/admin/identity-checks?status=approved', { token: adminToken });
const approved = r.json.find((c) => c.id === second.id);
const kept = approved ? await fetch(approved.images.documentFrontUrl) : { status: 0 };
check('photos conservées après validation (consultables par l’admin)', kept.status === 200, kept.status);
r = await call('GET', '/admin/sellers', { token: adminToken });
check('liste des vendeurs : identité « vérifiée »', r.json.find((s) => s.email === aicha.email)?.identityChecks?.[0]?.status === 'approved');

console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko > 0 ? 1 : 0);
