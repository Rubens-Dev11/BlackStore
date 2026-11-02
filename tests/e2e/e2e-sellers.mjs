// Test de bout en bout des comptes vendeurs, contre l'API de test locale.
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

let ipCounter = 0;
async function call(method, path, { body, token, cookie, ip } = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Real-IP': ip ?? `10.9.0.${++ipCounter}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, setCookie: res.headers.getSetCookie?.() ?? [] };
}

// Quoted-printable → texte UTF-8 (corps des e-mails et mots encodés des en-têtes).
const decodeQP = (s) => {
  const soft = s.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < soft.length; i++) {
    const hex = soft.slice(i + 1, i + 3);
    if (soft[i] === '=' && /^[0-9A-F]{2}$/i.test(hex)) { bytes.push(parseInt(hex, 16)); i += 2; }
    else bytes.push(...Buffer.from(soft[i], 'utf8'));
  }
  return Buffer.from(bytes).toString('utf8');
};
const decodeHeader = (h) => h.replace(/=\?UTF-8\?Q\?(.*?)\?=\s*/gi, (_, q) => decodeQP(q.replace(/_/g, ' ')));
async function lastMailTo(email, subjectPart) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILHOG}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`);
    const data = await res.json();
    const item = (data.items ?? []).find((m) => decodeHeader(m.Content.Headers.Subject?.[0] ?? '').includes(subjectPart));
    if (item) return { subject: decodeHeader(item.Content.Headers.Subject[0]), body: decodeQP(item.Content.Body) };
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}
const tokenFrom = (body, path) => body.match(new RegExp(`${path}\\?token=([a-f0-9]{64})`))?.[1];

const email = `vendeur.${Date.now()}@test.local`;
const password = 'motdepasse1';
const seller = { firstName: 'Awa', lastName: 'Ngono', email, phone: '6 99 00 00 01', password, acceptTerms: true };

section('1. Inscription');
let r = await call('POST', '/seller/auth/register', { body: seller });
check('inscription acceptée (201)', r.status === 201, JSON.stringify(r.json));
r = await call('POST', '/seller/auth/register', { body: seller });
check('même e-mail refusé (409)', r.status === 409, `${r.status}`);
r = await call('POST', '/seller/auth/register', { body: { ...seller, email: `x${email}`, password: 'sanschiffre' } });
check('mot de passe sans chiffre refusé (400, message en français)', r.status === 400 && JSON.stringify(r.json).includes('au moins une lettre et un chiffre'), JSON.stringify(r.json));
r = await call('POST', '/seller/auth/register', { body: { ...seller, email: `y${email}`, phone: 'abc' } });
check('téléphone invalide refusé (400)', r.status === 400, `${r.status}`);
r = await call('POST', '/seller/auth/register', { body: { ...seller, email: `z${email}`, isAdmin: true } });
check('champ inconnu refusé (400)', r.status === 400, `${r.status}`);

section("2. Confirmation de l'e-mail");
r = await call('POST', '/seller/auth/login', { body: { email, password } });
check('connexion refusée avant confirmation (403 EMAIL_NOT_VERIFIED)', r.status === 403 && r.json.code === 'EMAIL_NOT_VERIFIED', JSON.stringify(r.json));
const verifMail = await lastMailTo(email, 'Confirmez votre adresse');
check('e-mail de confirmation reçu', !!verifMail);
const verifToken = verifMail && tokenFrom(verifMail.body, 'http://localhost:3002/vendeur/verifier-email');
check("lien de confirmation vers l'espace vendeur, jeton de 64 caractères", !!verifToken);
r = await call('POST', '/seller/auth/verify-email', { body: { token: 'a'.repeat(64) } });
check('faux lien refusé (400)', r.status === 400, `${r.status}`);
r = await call('POST', '/seller/auth/verify-email', { body: { token: verifToken } });
check('vrai lien accepté (200)', r.status === 200, JSON.stringify(r.json));
r = await call('POST', '/seller/auth/verify-email', { body: { token: verifToken } });
check('lien utilisable une seule fois (400)', r.status === 400, `${r.status}`);

section('3. Connexion et session');
r = await call('POST', '/seller/auth/login', { body: { email, password: 'mauvais1234' } });
check('mauvais mot de passe refusé (401)', r.status === 401, `${r.status}`);
r = await call('POST', '/seller/auth/login', { body: { email: 'inconnu@test.local', password } });
check('e-mail inconnu : même réponse (401)', r.status === 401 && r.json.message === 'E-mail ou mot de passe incorrect', JSON.stringify(r.json));
r = await call('POST', '/seller/auth/login', { body: { email: email.toUpperCase(), password } });
check('connexion acceptée, e-mail insensible à la casse (200)', r.status === 200 && !!r.json.accessToken, `${r.status}`);
let access = r.json.accessToken;
const refreshCookie = r.setCookie.find((c) => c.startsWith('seller_refresh_token='));
check('cookie de session vendeur httpOnly posé', !!refreshCookie && /HttpOnly/i.test(refreshCookie));
const cookie = refreshCookie?.split(';')[0];
r = await call('GET', '/seller/me', { token: access });
check('profil lisible (200), statut en attente', r.status === 200 && r.json.status === 'pending', JSON.stringify(r.json));
check('téléphone normalisé en +237699000001', r.json.phone === '+237699000001', r.json.phone);
check('aucun hash de mot de passe renvoyé', !JSON.stringify(r.json).includes('passwordHash'));
r = await call('GET', '/seller/me');
check('profil sans jeton refusé (401)', r.status === 401, `${r.status}`);
r = await call('POST', '/seller/auth/refresh', { cookie });
check('session renouvelée avec le cookie (200)', r.status === 200 && !!r.json.accessToken, `${r.status}`);
r = await call('POST', '/seller/auth/refresh');
check('renouvellement sans cookie refusé (401)', r.status === 401, `${r.status}`);
r = await call('PATCH', '/seller/me', { token: access, body: { phone: '699 11 22 33', lastName: 'Ngono Mballa' } });
check('profil modifié, téléphone normalisé', r.status === 200 && r.json.phone === '+237699112233' && r.json.lastName === 'Ngono Mballa', JSON.stringify(r.json));

section('4. Séparation vendeur / administrateur');
r = await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: ADMIN_PASSWORD } });
check('connexion admin (200)', r.status === 200 && !!r.json.accessToken, `${r.status}`);
const adminToken = r.json.accessToken;
r = await call('GET', '/admin/sellers', { token: access });
check("jeton vendeur refusé sur l'admin (401)", r.status === 401, `${r.status}`);
r = await call('GET', '/products/admin/all', { token: access });
check('jeton vendeur refusé sur les produits admin (401)', r.status === 401, `${r.status}`);
r = await call('GET', '/seller/me', { token: adminToken });
check('jeton admin refusé sur l’espace vendeur (401)', r.status === 401, `${r.status}`);
r = await call('POST', '/auth/refresh', { cookie: cookie?.replace('seller_refresh_token', 'refresh_token') });
check('session vendeur refusée par le renouvellement admin (401)', r.status === 401, `${r.status}`);

section('5. Validation par l’administrateur');
r = await call('GET', '/admin/sellers?status=pending', { token: adminToken });
const listed = Array.isArray(r.json) ? r.json.find((s) => s.email === email) : null;
check('vendeur listé en attente', r.status === 200 && !!listed, `${r.status}`);
r = await call('GET', '/admin/sellers?status=nimporte', { token: adminToken });
check('filtre de statut invalide refusé (400)', r.status === 400, `${r.status}`);
r = await call('PATCH', `/admin/sellers/${listed.id}/status`, { token: adminToken, body: { status: 'approved' } });
check('vendeur validé (200)', r.status === 200 && r.json.status === 'approved', JSON.stringify(r.json));
check('e-mail « compte validé » reçu', !!(await lastMailTo(email, 'est validé')));
r = await call('GET', '/seller/me', { token: access });
check('le vendeur voit son statut validé', r.json.status === 'approved', r.json.status);

section('6. Changement de mot de passe');
r = await call('PATCH', '/seller/me/password', { token: access, body: { currentPassword: 'faux1234', newPassword: 'nouveau12345' } });
check('mot de passe actuel incorrect refusé (400)', r.status === 400, `${r.status}`);
r = await call('PATCH', '/seller/me/password', { token: access, body: { currentPassword: password, newPassword: 'nouveau12345' } });
check('mot de passe changé (200)', r.status === 200, `${r.status}`);
r = await call('GET', '/seller/me', { token: access });
check('ancienne session fermée (401)', r.status === 401, `${r.status}`);
r = await call('POST', '/seller/auth/refresh', { cookie });
check('ancien cookie de session refusé (401)', r.status === 401, `${r.status}`);

section('7. Mot de passe oublié');
r = await call('POST', '/seller/auth/forgot-password', { body: { email: 'inconnu@test.local' } });
check('e-mail inconnu : réponse neutre (200)', r.status === 200, `${r.status}`);
r = await call('POST', '/seller/auth/forgot-password', { body: { email } });
check('demande acceptée (200)', r.status === 200, `${r.status}`);
const resetMail = await lastMailTo(email, 'Réinitialisation');
const resetToken = resetMail && tokenFrom(resetMail.body, 'http://localhost:3002/vendeur/reinitialiser-mot-de-passe');
check('e-mail de réinitialisation reçu avec son lien', !!resetToken);
r = await call('POST', '/seller/auth/reset-password', { body: { token: resetToken, newPassword: 'court' } });
check('nouveau mot de passe trop faible refusé (400)', r.status === 400, `${r.status}`);
r = await call('POST', '/seller/auth/reset-password', { body: { token: resetToken, newPassword: 'reinit2026ok' } });
check('mot de passe réinitialisé (200)', r.status === 200, JSON.stringify(r.json));
r = await call('POST', '/seller/auth/reset-password', { body: { token: resetToken, newPassword: 'autre2026ok' } });
check('lien de réinitialisation à usage unique (400)', r.status === 400, `${r.status}`);
r = await call('POST', '/seller/auth/login', { body: { email, password: 'nouveau12345' } });
check('ancien mot de passe refusé (401)', r.status === 401, `${r.status}`);
r = await call('POST', '/seller/auth/login', { body: { email, password: 'reinit2026ok' } });
check('nouveau mot de passe accepté (200)', r.status === 200, `${r.status}`);
access = r.json.accessToken;

section('8. Suspension');
r = await call('PATCH', `/admin/sellers/${listed.id}/status`, { token: adminToken, body: { status: 'suspended' } });
check('vendeur suspendu (200)', r.status === 200 && r.json.status === 'suspended', `${r.status}`);
check('e-mail « compte suspendu » reçu', !!(await lastMailTo(email, 'est suspendu')));
r = await call('GET', '/seller/me', { token: access });
check('session active coupée immédiatement (401)', r.status === 401, `${r.status}`);
r = await call('POST', '/seller/auth/login', { body: { email, password: 'reinit2026ok' } });
check('connexion refusée (403 ACCOUNT_SUSPENDED)', r.status === 403 && r.json.code === 'ACCOUNT_SUSPENDED', JSON.stringify(r.json));
r = await call('POST', '/seller/auth/forgot-password', { body: { email } });
const before = (await (await fetch(`${MAILHOG}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`)).json()).total;
// Reçus jusqu'ici : confirmation, compte validé, réinitialisation, compte suspendu.
check('mot de passe oublié : réponse neutre, sans e-mail pour un compte suspendu', r.status === 200 && before === 4, `total e-mails = ${before}`);
r = await call('PATCH', `/admin/sellers/${listed.id}/status`, { token: adminToken, body: { status: 'approved' } });
check('vendeur réactivé (200)', r.status === 200 && r.json.status === 'approved', `${r.status}`);

section('9. Sécurité des e-mails');
const htmlEmail = `html.${Date.now()}@test.local`;
await call('POST', '/seller/auth/register', { body: { ...seller, email: htmlEmail, firstName: '<b>Zoé</b>' } });
const htmlMail = await lastMailTo(htmlEmail, 'Confirmez');
check('prénom échappé dans l’e-mail (pas de balise injectée)', !!htmlMail && htmlMail.body.includes('&lt;b&gt;Zo') && !htmlMail.body.includes('<b>Zo'));

section('10. Limite de tentatives (par adresse IP)');
const statuses = [];
for (let i = 0; i < 6; i++) {
  const x = await call('POST', '/seller/auth/register', { ip: '10.8.8.8', body: { ...seller, email: `rate${i}.${Date.now()}@test.local` } });
  statuses.push(x.status);
}
check('6e inscription en une minute bloquée (429)', statuses[5] === 429 && statuses.slice(0, 5).every((s) => s === 201), statuses.join(','));
r = await call('POST', '/seller/auth/register', { ip: '10.8.8.9', body: { ...seller, email: `rateother.${Date.now()}@test.local` } });
check('une autre adresse IP n’est pas bloquée (201)', r.status === 201, `${r.status}`);

console.log(`\nRésultat : ${ok} réussis, ${ko} échoués`);
process.exit(ko === 0 ? 0 : 1);
