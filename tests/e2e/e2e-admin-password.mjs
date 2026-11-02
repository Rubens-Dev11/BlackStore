// Essais de bout en bout du changement obligatoire du mot de passe admin : sessions fermées, code par
// e-mail, essais limités, expiration, limites d'envoi, nouveau mot de passe, limite de connexion par IP.
// Usage : BS_ADMIN_PASSWORD=… BS_PG_PASS=… node e2e-admin-password.mjs
import { execSync } from 'child_process';

const API = 'http://localhost:3100';
const ADMIN = 'admin@blackstore.cm';
let ok = 0;
let ko = 0;
const check = (label, condition, detail) => {
  condition ? ok++ : ko++;
  console.log(`  ${condition ? '✓' : '✗'} ${label}${condition ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
};
const section = (title) => console.log(`\n${title}`);
// Sous Windows, execSync passe par cmd.exe : les « $ » des empreintes bcrypt n'ont pas à être échappés.
// Sous Windows, execSync passe par cmd.exe : les « $ » des empreintes bcrypt n'ont pas à être échappés.
const sql = (query) =>
  execSync(`docker exec -e PGPASSWORD=${process.env.BS_PG_PASS} bs-test-postgres psql -U bstest -d bstest -tAc "${query.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
  }).trim();
let ipCount = 0;
async function call(method, path, { body, token, ip, cookie } = {}) {
  const headers = { 'X-Real-IP': ip ?? `10.82.0.${++ipCount}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, text, setCookie: res.headers.get('set-cookie') ?? '' };
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
async function mails() {
  const data = await (await fetch(`http://localhost:8028/api/v2/search?kind=to&query=${encodeURIComponent(ADMIN)}`)).json();
  return data.items
    .map((m) => ({ subject: decodeHeader(m.Content.Headers.Subject[0]), body: decodeQP(m.Content.Body), date: m.Created }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
const codeOf = (mail) => mail?.body.match(/>(\d{6})<\/span>/)?.[1];
const login = (password, extra = {}) => call('POST', '/auth/login', { body: { email: ADMIN, password }, ...extra });
const confirm = (challenge, code, newPassword) => call('POST', '/auth/password/confirm', { body: { challenge, code, newPassword } });
const backdate = () => sql("update admin_password_challenges set created_at = created_at - interval '2 minutes'");

const original = sql(`select password_hash from admins where email = '${ADMIN}'`);
const NEW_PASSWORD = `Nouveau-${Date.now().toString(36)}-mot2passe`;

try {
  // ── Connexion normale ─────────────────────────────────────────────────
  section('Connexion normale (mot de passe à jour)');
  let r = await login(process.env.BS_ADMIN_PASSWORD);
  const before = r.json;
  check('connexion admin : jetons, cookie de session', r.status === 200 && !!before.accessToken && r.setCookie.includes('refresh_token='), r.status);
  r = await call('POST', '/auth/login', { body: { email: '  Admin@BlackStore.CM ', password: process.env.BS_ADMIN_PASSWORD } });
  check('adresse avec majuscules et espaces acceptée', r.status === 200 && !!r.json.accessToken, r.json);
  r = await call('GET', '/admin/disputes', { token: before.accessToken });
  check('page admin accessible', r.status === 200, r.status);

  section('Limite de connexion par IP');
  // Adresse propre à ce passage : le blocage d'un passage précédent dure encore un moment.
  const throttledIp = `10.84.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const statuses = [];
  for (let i = 0; i < 11; i++) statuses.push((await login('mauvais-mot-de-passe', { ip: throttledIp })).status);
  check('10 essais par minute, puis 429', statuses.slice(0, 10).every((s) => s === 401) && statuses[10] === 429, statuses);
  r = await login('mauvais-mot-de-passe', { ip: '10.85.0.1' });
  check('une autre adresse IP n’est pas bloquée', r.status === 401, r.status);

  // ── Mot de passe à remplacer ──────────────────────────────────────────
  section('Mot de passe à remplacer : sessions fermées');
  sql(`update admins set must_change_password = true where email = '${ADMIN}'`);
  r = await call('GET', '/admin/disputes', { token: before.accessToken });
  check('jeton ouvert avant : refusé (401)', r.status === 401, r.status);
  r = await call('POST', '/auth/refresh', { cookie: `refresh_token=${before.refreshToken}` });
  check('renouvellement de session refusé (401)', r.status === 401, r.status);

  section('Connexion : code envoyé par e-mail, pas de session');
  const mailsBefore = (await mails()).length;
  r = await login('mauvais-mot-de-passe');
  check('mauvais mot de passe : 401, aucun e-mail', r.status === 401 && (await mails()).length === mailsBefore, r.status);
  r = await login(process.env.BS_ADMIN_PASSWORD);
  const first = r.json;
  check(
    'bon mot de passe : code demandé, sans jeton ni cookie',
    r.status === 200 && first.passwordChangeRequired === true && !first.accessToken && !first.refreshToken && !r.setCookie.includes('refresh_token='),
    r.json,
  );
  check('adresse masquée et durée', first.sentTo === 'ad•••in@blackstore.cm' && first.expiresInMinutes === 15, first);
  let mail = (await mails())[0];
  const code = codeOf(mail);
  check('e-mail reçu avec un code à 6 chiffres', (await mails()).length === mailsBefore + 1 && mail.subject === 'Votre code de sécurité — BlackStore Admin' && /^\d{6}$/.test(code ?? ''), mail?.subject);
  check('e-mail : ni mot de passe ni jeton', !mail.body.includes(process.env.BS_ADMIN_PASSWORD) && !mail.body.includes(first.challenge));
  const row = sql('select token_hash, code_hash, attempts from admin_password_challenges').split('|');
  check('base : seules des empreintes sont gardées', row[0].length === 64 && row[0] !== first.challenge && row[1].length === 64 && !row[1].includes(code) && row[2] === '0', row);
  r = await login(process.env.BS_ADMIN_PASSWORD);
  check('nouvelle demande dans la minute : 429', r.status === 429 && /attendez une minute/.test(msg(r)), msg(r));

  section('Code et nouveau mot de passe');
  r = await confirm(first.challenge, '12ab', NEW_PASSWORD);
  check('code mal formé : 400', r.status === 400 && /6 chiffres/.test(msg(r)), msg(r));
  r = await confirm(first.challenge, code, 'court');
  check('mot de passe trop court : 400', r.status === 400 && /12 caractères/.test(msg(r)), msg(r));
  r = await confirm('x'.repeat(43), code, NEW_PASSWORD);
  check('demande inconnue : 410', r.status === 410 && /reconnectez-vous/.test(msg(r)), msg(r));
  const wrong = code === '000000' ? '000001' : '000000';
  r = await confirm(first.challenge, wrong, NEW_PASSWORD);
  check('mauvais code : 400, 4 essais restants', r.status === 400 && msg(r) === 'Code incorrect : il vous reste 4 essais.', msg(r));
  r = await confirm(first.challenge, code, process.env.BS_ADMIN_PASSWORD);
  check('ancien mot de passe refusé comme nouveau : 400', r.status === 400 && /différent de l'ancien/.test(msg(r)), msg(r));
  r = await confirm(first.challenge, `${code.slice(0, 3)} ${code.slice(3)}`, NEW_PASSWORD);
  const after = r.json;
  check('bon code (avec espace) : mot de passe remplacé, session ouverte', r.status === 200 && !!after.accessToken && r.setCookie.includes('refresh_token='), r.json);
  r = await call('GET', '/admin/disputes', { token: after.accessToken });
  check('nouvelle session : page admin accessible', r.status === 200, r.status);
  check('base : drapeau levé, demandes effacées, dernière connexion', sql(`select must_change_password from admins where email = '${ADMIN}'`) === 'f' && sql('select count(*) from admin_password_challenges') === '0' && sql(`select last_login > now() - interval '1 minute' from admins where email = '${ADMIN}'`) === 't');
  r = await confirm(first.challenge, code, `${NEW_PASSWORD}-bis`);
  check('code déjà utilisé : 410', r.status === 410, r.status);
  r = await login(process.env.BS_ADMIN_PASSWORD);
  check('ancien mot de passe : 401', r.status === 401, r.status);
  r = await login(NEW_PASSWORD);
  check('nouveau mot de passe : connexion normale', r.status === 200 && !!r.json.accessToken, r.json);

  // ── Limites ───────────────────────────────────────────────────────────
  section('Essais épuisés');
  sql(`update admins set must_change_password = true where email = '${ADMIN}'`);
  r = await login(NEW_PASSWORD);
  const second = r.json;
  const code2 = codeOf((await mails())[0]);
  check('nouveau code envoyé', r.status === 200 && second.passwordChangeRequired && /^\d{6}$/.test(code2 ?? ''), r.json);
  const wrong2 = code2 === '000000' ? '000001' : '000000';
  const messages = [];
  for (let i = 0; i < 5; i++) messages.push((await confirm(second.challenge, wrong2, `${NEW_PASSWORD}-2`)).json.message);
  check(
    '4 erreurs comptées, la 5e ferme le code',
    messages[0] === 'Code incorrect : il vous reste 4 essais.' && messages[3] === 'Code incorrect : il vous reste 1 essai.' && /dernier essai/.test(messages[4]),
    messages,
  );
  r = await confirm(second.challenge, code2, `${NEW_PASSWORD}-2`);
  check('bon code après 5 erreurs : 410', r.status === 410, r.status);

  section('Essais simultanés');
  backdate();
  r = await login(NEW_PASSWORD);
  const third = r.json;
  const code3 = codeOf((await mails())[0]);
  const wrong3 = code3 === '000000' ? '000001' : '000000';
  const parallel = await Promise.all(Array.from({ length: 12 }, () => confirm(third.challenge, wrong3, `${NEW_PASSWORD}-3`)));
  const attempts = sql(`select attempts from admin_password_challenges where token_hash = encode(sha256('${third.challenge}'::bytea), 'hex')`);
  check('12 essais en même temps : 5 comptés au plus, aucun accepté', attempts === '5' && parallel.every((p) => p.status === 400 || p.status === 410) && parallel.filter((p) => p.status === 400).length <= 4, { attempts, s: parallel.map((p) => p.status) });

  section('Code expiré');
  backdate();
  r = await login(NEW_PASSWORD);
  const fourth = r.json;
  const code4 = codeOf((await mails())[0]);
  sql("update admin_password_challenges set expires_at = now() - interval '1 second'");
  r = await confirm(fourth.challenge, code4, `${NEW_PASSWORD}-4`);
  check('code expiré : 410', r.status === 410 && /reconnectez-vous/.test(msg(r)), msg(r));

  section('5 codes par heure au plus');
  backdate();
  const count = Number(sql("select count(*) from admin_password_challenges where created_at > now() - interval '1 hour'"));
  for (let i = count; i < 5; i++) {
    sql(`insert into admin_password_challenges (id, admin_id, token_hash, code_hash, expires_at, created_at) select gen_random_uuid(), id, md5(random()::text) || md5(random()::text), 'x', now(), now() - interval '10 minutes' from admins where email = '${ADMIN}'`);
  }
  const mailsNow = (await mails()).length;
  r = await login(NEW_PASSWORD);
  check('6e code dans l’heure : 429, aucun e-mail', r.status === 429 && /une heure/.test(msg(r)) && (await mails()).length === mailsNow, msg(r));

  section('E-mail impossible à envoyer');
  sql('delete from admin_password_challenges');
  execSync('docker stop bs-test-mailhog', { stdio: 'ignore' });
  r = await login(NEW_PASSWORD);
  check('serveur d’e-mail arrêté : 503 et aucune demande gardée', r.status === 503 && /n'a pas pu être envoyé/.test(msg(r)) && sql('select count(*) from admin_password_challenges') === '0', { s: r.status, m: msg(r) });
  execSync('docker start bs-test-mailhog', { stdio: 'ignore' });
} finally {
  // Le mot de passe d'origine des essais est remis, pour les essais suivants.
  sql(`update admins set password_hash = '${original}', must_change_password = false where email = '${ADMIN}'`);
  sql('delete from admin_password_challenges');
  execSync('docker start bs-test-mailhog', { stdio: 'ignore' });
}
section('Remise en état');
const restored = await login(process.env.BS_ADMIN_PASSWORD);
check('mot de passe des essais remis', restored.status === 200 && !!restored.json.accessToken, restored.status);

console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko ? 1 : 0);
