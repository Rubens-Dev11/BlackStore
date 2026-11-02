// Antivirus indisponible : le fichier reste bloqué, l'échec final est noté, la relance fonctionne.
// À lancer avec le faux clamd ARRÊTÉ. Usage : BS_ADMIN_PASSWORD=… node e2e-antivirus-down.mjs <e-mail vendeur>
import { spawn } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { Queue } = require('bullmq');
const API = 'http://localhost:3100';
const email = process.argv[2];
let ok = 0;
let ko = 0;
const check = (label, cond, detail) => {
  cond ? ok++ : ko++;
  console.log(`  ${cond ? '✓' : '✗'} ${label}${cond ? '' : ` — ${JSON.stringify(detail)}`}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(method, path, { body, token, form } = {}) {
  const headers = { 'X-Real-IP': '10.8.8.8' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const admin = (await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: process.env.BS_ADMIN_PASSWORD } })).json.accessToken;
const sellers = (await call('GET', '/admin/sellers', { token: admin })).json;
const seller = sellers.find((s) => s.email === email);
await call('PATCH', `/admin/sellers/${seller.id}/status`, { token: admin, body: { status: 'approved' } });
const token = (await call('POST', '/seller/auth/login', { body: { email, password: 'vendeur2026' } })).json.accessToken;
const product = (await call('GET', '/seller/products', { token })).json.find((p) => p.name === 'Modèles gratuits');
check('vendeur réactivé, produit retrouvé', !!product, product);

const form = new FormData();
form.append('file', new Blob(['PK-version-3']), 'modeles-v3.zip');
let r = await call('POST', `/seller/products/${product.id}/file`, { token, form });
check('fichier reçu malgré l’antivirus arrêté', r.status === 201 && r.json.scanStatus === 'pending', r);
await wait(3000);
r = await call('GET', `/seller/products/${product.id}`, { token });
check('toujours en attente d’analyse (essais rejoués)', r.json.scanStatus === 'pending', r.json.scanStatus);
r = await call('GET', `/products/${product.slug}`);
check('produit invisible tant que le fichier n’est pas analysé', r.status === 404, r.status);

// Dernier essai simulé : une tâche à un seul essai, qui échoue.
const objectKey = (await call('GET', `/admin/products/review?status=approved`, { token: admin })).json.find((p) => p.id === product.id);
const queue = new Queue('file-scan', { connection: { host: 'localhost', port: 6380 } });
const fileKey = await (async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const p = await prisma.product.findUnique({ where: { id: product.id } });
  await prisma.$disconnect();
  return p.filePath;
})();
await queue.add('scan', { productId: product.id, objectKey: fileKey }, { attempts: 1 });
await wait(3000);
r = await call('GET', `/seller/products/${product.id}`, { token });
check('échec final noté « analyse impossible »', r.json.scanStatus === 'failed', r.json.scanStatus);
const review = (await call('GET', '/admin/products/review?status=approved', { token: admin })).json.find((p) => p.id === product.id);
check('cause visible par l’admin', /ECONNREFUSED|connect/i.test(review?.scanResult ?? ''), review?.scanResult);
check('détail technique caché au vendeur', r.json.scanThreat === null, r.json.scanThreat);

// L'antivirus revient : relance par l'admin.
const clamd = spawn(process.execPath, [new URL('./fake-clamd.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '3310'], { stdio: 'ignore' });
await wait(1000);
r = await call('POST', `/admin/products/${product.id}/rescan`, { token: admin });
check('relance acceptée', r.status === 201 && r.json.scanStatus === 'pending', r);
await wait(3000);
r = await call('GET', `/seller/products/${product.id}`, { token });
check('fichier analysé et sain', r.json.scanStatus === 'clean' && r.json.isPublic, r.json);
clamd.kill();
await queue.close();
console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko ? 1 : 0);
