// Essais de bout en bout : pages légales (informations de l'éditeur), acceptation des conditions
// (vendeurs, commandes), formulaire de contact et réponses de l'admin, avis sans e-mail, liens de
// téléchargement coupés après un remboursement. Usage : BS_ADMIN_PASSWORD=… BS_PG_PASS=… node e2e-legal.mjs
import { execSync } from 'child_process';

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
const sql = (query) =>
  execSync(`docker exec -e PGPASSWORD=${process.env.BS_PG_PASS} bs-test-postgres psql -U bstest -d bstest -tAc "${query.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
  }).trim();
async function call(method, path, { body, token, form, ip = '10.62.0.1', redirect } = {}) {
  const headers = { 'X-Real-IP': ip };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined), redirect });
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
const decodeHeader = (h) => h.replace(/=\?UTF-8\?Q\?(.*?)\?=\s*/gi, (_, q) => decodeQP(q.replace(/_/g, ' ')));
async function mails(email) {
  const data = await (await fetch(`http://localhost:8028/api/v2/search?kind=to&query=${encodeURIComponent(email)}`)).json();
  return data.items.map((m) => ({
    subject: decodeHeader(m.Content.Headers.Subject[0]),
    replyTo: (m.Content.Headers['Reply-To'] ?? [null])[0],
    body: decodeQP(m.Content.Body),
  }));
}

section('Préparation');
sql("update marketplace_settings set legal_name = null, legal_form = null, legal_address = null, rccm = null, niu = null, contact_email = null, contact_phone = null, hosting_info = null, commission_rate = 10, hold_days = 7, min_withdrawal = 5000");
const admin = (await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: process.env.BS_ADMIN_PASSWORD } })).json.accessToken;
check('connexion admin', !!admin);
const categoryId = (await call('GET', '/categories')).json[0].id;

section('Informations des pages légales');
let r = await call('GET', '/legal');
check('version des textes et règles de la marketplace', r.status === 200 && r.json.version === '2026-10-09' && r.json.marketplace.commissionRate === 10 && r.json.marketplace.holdDays === 7 && r.json.marketplace.minWithdrawal === 5000, r.json);
check('éditeur pas encore renseigné', r.json.operator.name === null && r.json.contact.email === null && r.json.hosting === null, r.json);
check('adresses du site et de l’espace vendeur', r.json.urls.storefront === 'http://localhost:3001' && r.json.urls.sellerApp === 'http://localhost:3002', r.json.urls);
r = await call('PUT', '/admin/legal-info', { body: { legalName: 'Pirate' } });
check('modification réservée à l’admin', r.status === 401, r.status);
r = await call('PUT', '/admin/legal-info', { token: admin, body: { contactEmail: 'pas-un-email' } });
check('e-mail de contact invalide refusé', r.status === 400 && /e-mail de contact/.test(msg(r)), msg(r));
r = await call('PUT', '/admin/legal-info', { token: admin, body: { contactPhone: 'appelez-moi' } });
check('téléphone invalide refusé', r.status === 400, msg(r));
r = await call('PUT', '/admin/legal-info', { token: admin, body: { legalName: 'x'.repeat(161) } });
check('nom trop long refusé', r.status === 400, msg(r));
r = await call('PUT', '/admin/legal-info', { token: admin, body: { legalName: 'Jean Testeur', unknown: 1 } });
check('champ inconnu refusé', r.status === 400, msg(r));
r = await call('PUT', '/admin/legal-info', {
  token: admin,
  body: {
    legalName: '  Jean Testeur  ',
    legalForm: 'Entreprise individuelle',
    legalAddress: 'Akwa, Douala',
    rccm: 'RC/DLA/2026/A/0001',
    niu: 'P000000000000A',
    contactEmail: 'contact@test.local',
    contactPhone: '+237 6 99 00 00 00',
    hostingInfo: 'Hébergeur Test, Bonanjo, Douala',
  },
});
check('informations enregistrées (espaces retirés)', r.status === 200 && r.json.legalName === 'Jean Testeur' && r.json.rccm === 'RC/DLA/2026/A/0001', r.json);
r = await call('GET', '/legal');
check('affichées par la route publique', r.json.operator.name === 'Jean Testeur' && r.json.operator.address === 'Akwa, Douala' && r.json.contact.email === 'contact@test.local' && r.json.hosting === 'Hébergeur Test, Bonanjo, Douala', r.json);
r = await call('PUT', '/admin/legal-info', { token: admin, body: { rccm: '', niu: '' } });
check('champ vidé = effacé, les autres restent', r.json.rccm === null && r.json.niu === null && r.json.legalName === 'Jean Testeur', r.json);
await call('PUT', '/admin/wallet/settings', { token: admin, body: { commissionRate: 12.5, holdDays: 5, minWithdrawal: 3000 } });
r = await call('GET', '/legal');
check('les conditions suivent les réglages (12,5 %, 5 jours, 3 000 FCFA)', r.json.marketplace.commissionRate === 12.5 && r.json.marketplace.holdDays === 5 && r.json.marketplace.minWithdrawal === 3000, r.json.marketplace);
await call('PUT', '/admin/wallet/settings', { token: admin, body: { commissionRate: 10, holdDays: 7, minWithdrawal: 5000 } });

section('Conditions vendeurs acceptées à l’inscription');
const email = `legal.${run}@test.local`;
const seller = { firstName: 'Mireille', lastName: 'Essomba', email, phone: '677445566', password: 'vendeur2026' };
r = await call('POST', '/seller/auth/register', { body: seller });
check('inscription sans accepter : refusée', r.status === 400 && /conditions vendeurs/.test(msg(r)), msg(r));
r = await call('POST', '/seller/auth/register', { body: { ...seller, acceptTerms: false } });
check('case décochée : refusée', r.status === 400, msg(r));
r = await call('POST', '/seller/auth/register', { body: { ...seller, acceptTerms: 'false' } });
check('« false » en texte : refusé', r.status === 400, msg(r));
r = await call('POST', '/seller/auth/register', { body: { ...seller, acceptTerms: true } });
check('case cochée : compte créé', r.status === 201, [r.status, msg(r)]);
check('version et date d’acceptation enregistrées', sql(`select terms_version || '|' || (terms_accepted_at is not null) from sellers where email = '${email}'`) === '2026-10-09|true');

section('Conditions générales acceptées à la commande');
const demo = (await call('GET', '/products/logiciel-demo-desktop-v2')).json;
const buyer = `acheteur.${run}@test.local`;
const order = { customerName: 'Jean-Paul Testeur Ngono', customerEmail: buyer, customerPhone: '699001122', items: [{ productId: demo.id, quantity: 1 }] };
r = await call('POST', '/orders', { body: order });
check('commande sans accepter : refusée', r.status === 400 && /conditions générales de vente/.test(msg(r)), msg(r));
r = await call('POST', '/orders', { body: { ...order, acceptTerms: true } });
const paidOrder = r.json;
check('case cochée : commande créée', r.status === 201 && !!paidOrder.orderNumber, [r.status, msg(r)]);
check('version acceptée enregistrée sur la commande', sql(`select terms_version from orders where id = '${paidOrder.id}'`) === '2026-10-09');

section('Formulaire de contact');
const contact = { topic: 'refund', name: 'Jean-Paul Testeur', email: buyer, orderNumber: paidOrder.orderNumber.toLowerCase(), message: 'Le logiciel ne se lance pas : <b>erreur 0xc000007b</b> au démarrage.' };
r = await call('POST', '/contact', { ip: '10.62.1.1', body: { ...contact, topic: 'plainte' } });
check('sujet inconnu refusé', r.status === 400, msg(r));
r = await call('POST', '/contact', { ip: '10.62.1.2', body: { ...contact, email: 'pas-un-email' } });
check('e-mail invalide refusé', r.status === 400 && /e-mail valide/.test(msg(r)), msg(r));
r = await call('POST', '/contact', { ip: '10.62.1.3', body: { ...contact, message: 'Aidez' } });
check('message trop court refusé', r.status === 400, msg(r));
r = await call('POST', '/contact', { ip: '10.62.1.4', body: { ...contact, orderNumber: '12345' } });
check('numéro de commande invalide refusé', r.status === 400 && /commande invalide/.test(msg(r)), msg(r));
r = await call('POST', '/contact', { ip: '10.62.1.5', body: { ...contact, isAdmin: true } });
check('champ inconnu refusé', r.status === 400, msg(r));
const before = Number(sql('select count(*) from support_requests'));
r = await call('POST', '/contact', { ip: '10.62.1.6', body: { ...contact, website: 'http://spam.example' } });
check('robot (champ piège rempli) : réponse normale…', r.status === 201, r.status);
check('… mais rien n’est enregistré', Number(sql('select count(*) from support_requests')) === before);
r = await call('POST', '/contact', { ip: '10.62.1.7', body: contact });
check('message envoyé', r.status === 201 && /répondrons par e-mail/.test(r.json.message), [r.status, r.json]);
check('enregistré avec le numéro de commande en majuscules et l’IP transformée', sql(`select order_number || '|' || length(ip_hash) || '|' || status from support_requests where email = '${buyer}'`) === `${paidOrder.orderNumber}|64|open`);
await wait(800);
check('aucun e-mail automatique envoyé par le formulaire', (await mails(buyer)).every((m) => !/message/i.test(m.subject)));
for (let i = 0; i < 5; i++) await call('POST', '/contact', { ip: '10.62.2.1', body: { ...contact, email: `flood${i}.${run}@test.local` } });
r = await call('POST', '/contact', { ip: '10.62.2.1', body: { ...contact, email: `flood.${run}@test.local` } });
check('6e message de l’heure depuis la même adresse : 429', r.status === 429, r.status);
r = await call('POST', '/contact', { ip: '10.62.2.2', body: { ...contact, topic: 'other', orderNumber: '', email: `autre.${run}@test.local`, message: 'Une simple question sans commande.' } });
check('autre adresse : acceptée, numéro de commande facultatif', r.status === 201, [r.status, msg(r)]);

section('Messages dans l’admin');
r = await call('GET', '/admin/messages');
check('liste réservée à l’admin', r.status === 401, r.status);
r = await call('GET', '/admin/messages', { token: admin });
const request = Array.isArray(r.json) ? r.json.find((m) => m.email === buyer) : null;
check('message à traiter, avec son sujet', request?.topicLabel === 'Demande de remboursement' && request.status === 'open', request ?? r.json);
check('commande retrouvée (même e-mail)', request?.order?.id === paidOrder.id && request.order.sameEmail === true && request.order.status === 'pending', request?.order);
check('empreinte d’IP jamais renvoyée', request && !('ipHash' in request), request);
r = await call('PATCH', `/admin/messages/${request.id}`, { token: admin, body: { action: 'reply', reply: 'Ok' } });
check('réponse trop courte refusée', r.status === 400, msg(r));
r = await call('PATCH', `/admin/messages/${request.id}`, { token: admin, body: { action: 'reply' } });
check('réponse vide refusée', r.status === 400, msg(r));
r = await call('PATCH', `/admin/messages/${request.id}`, { token: admin, body: { action: 'reply', reply: 'Bonjour,\ninstallez Visual C++ puis relancez. Sinon, nous vous remboursons.' } });
check('réponse envoyée : message « répondu »', r.status === 200 && r.json.status === 'answered' && !!r.json.repliedAt, [r.status, msg(r)]);
await wait(1000);
const replyMail = (await mails(buyer)).find((m) => /Réponse à votre message/.test(m.subject));
check('e-mail de réponse reçu par le client', !!replyMail);
check('avec la réponse et le message d’origine en rappel', !!replyMail && replyMail.body.includes('installez Visual C++') && replyMail.body.includes('0xc000007b'), replyMail?.body?.slice(0, 300));
check('HTML du message neutralisé', !!replyMail && replyMail.body.includes('&lt;b&gt;') && !replyMail.body.includes('<b>erreur'), replyMail?.body?.slice(0, 400));
check('« répondre à » = e-mail de contact de l’éditeur', replyMail?.replyTo === 'contact@test.local', replyMail?.replyTo);
r = await call('PATCH', `/admin/messages/${request.id}`, { token: admin, body: { action: 'reply', reply: 'Remboursement effectué ce jour.' } });
check('deuxième réponse : historique conservé', r.json.reply.includes('Visual C++') && r.json.reply.includes('Remboursement effectué'), r.json.reply);
r = await call('GET', '/admin/messages?status=answered', { token: admin });
check('rangé dans « Répondus »', Array.isArray(r.json) && r.json.some((m) => m.id === request.id));
r = await call('PATCH', `/admin/messages/${request.id}`, { token: admin, body: { action: 'close' } });
check('classé', r.json.status === 'closed', r.json);
r = await call('PATCH', `/admin/messages/${request.id}`, { token: admin, body: { action: 'reopen' } });
check('rouvert', r.json.status === 'open', r.json);
r = await call('PATCH', `/admin/messages/${request.id}`, { token: admin, body: { action: 'supprimer' } });
check('action inconnue refusée', r.status === 400, r.status);
r = await call('PATCH', '/admin/messages/00000000-0000-4000-8000-000000000000', { token: admin, body: { action: 'close' } });
check('message inconnu : 404', r.status === 404, r.status);
const sellerToken = (await call('POST', '/seller/auth/login', { body: { email, password: 'vendeur2026' } })).json.accessToken;
r = await call('GET', '/admin/messages', { token: sellerToken });
check('jeton vendeur refusé', r.status === 401 || r.status === 403, r.status);

section('Avis : l’e-mail de l’auteur n’est jamais affiché');
sql(`update orders set status = 'paid', paid_at = now() where id = '${paidOrder.id}'`);
r = await call('POST', `/reviews/${demo.id}`, { body: { buyerEmail: buyer, rating: 5, comment: 'Très bon logiciel.' } });
check('avis déposé par un acheteur', r.status === 201, [r.status, msg(r)]);
await call('PATCH', `/reviews/${r.json.id}/approve`, { token: admin });
r = await call('GET', `/reviews/product/${demo.id}`);
const review = r.json.reviews?.find((v) => v.comment === 'Très bon logiciel.');
check('auteur affiché « Jean-Paul T. »', review?.author === 'Jean-Paul T.', review);
check('aucun e-mail dans la réponse publique', !JSON.stringify(r.json).includes(buyer) && review && !('buyerEmail' in review), review);

section('Téléchargement coupé après un remboursement');
const free = (await call('POST', '/products', { token: admin, body: { name: `Guide gratuit légal ${run}`, description: 'Un guide gratuit pour tester les liens.', price: 0, categoryId } })).json;
const upload = new FormData();
upload.append('file', new Blob(['%PDF-1.4 guide'], { type: 'application/pdf' }), 'guide.pdf');
await call('POST', `/products/${free.id}/upload`, { token: admin, form: upload });
await call('PATCH', `/products/${free.id}`, { token: admin, body: { isActive: true } });
r = await call('POST', '/orders', { body: { customerName: 'Awa Client', customerEmail: `gratuit.${run}@test.local`, items: [{ productId: free.id, quantity: 1 }], acceptTerms: true } });
check('commande gratuite payée d’office', r.status === 201 && r.json.status === 'paid', [r.status, r.json?.status, msg(r)]);
const token = sql(`select dt.token from download_tokens dt join order_items oi on oi.id = dt.order_item_id where oi.order_id = '${r.json.id}'`);
r = await call('GET', `/downloads/${token}`, { redirect: 'manual' });
check('lien valable avant remboursement', r.status === 302, r.status);
const freeOrderId = sql(`select oi.order_id from download_tokens dt join order_items oi on oi.id = dt.order_item_id where dt.token = '${token}'`);
r = await call('PATCH', `/orders/${freeOrderId}/refund`, { token: admin });
check('commande remboursée', r.status === 200 && r.json.status === 'refunded', [r.status, msg(r)]);
r = await call('GET', `/downloads/${token}`, { redirect: 'manual' });
check('lien refusé après remboursement (410)', r.status === 410 && /rembours/.test(msg(r)), [r.status, msg(r)]);

console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko ? 1 : 0);
