// Essais de bout en bout des sauvegardes automatiques : rattrapage au démarrage, copie vérifiée de la
// base, conservation 14 jours / 8 semaines / 6 mois, copie hors du serveur (seconde zone MinIO locale),
// versions des fichiers, purge des données anciennes, restauration réelle de la copie.
// Usage : BS_ADMIN_PASSWORD=… BS_PG_PASS=… BS_MINIO_USER=… BS_MINIO_PASS=… BACKUP_DIR=… node e2e-backups.mjs
import { execSync } from 'child_process';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';

const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const Minio = require('minio');
const { backupsToKeep } = require('./dist/src/modules/backups/rotation.js');

const API = 'http://localhost:3100';
const DIR = path.join(process.env.BACKUP_DIR, 'base');
let ok = 0;
let ko = 0;
const check = (label, condition, detail) => {
  condition ? ok++ : ko++;
  console.log(`  ${condition ? '✓' : '✗'} ${label}${condition ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
};
const section = (title) => console.log(`\n${title}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const docker = (args, input) =>
  execSync(`docker ${args}`, { encoding: 'utf8', input, env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).trim();
// Sous Windows, une commande sur plusieurs lignes serait coupée : la requête tient sur une ligne.
const sql = (query) =>
  docker(`exec -e PGPASSWORD=${process.env.BS_PG_PASS} bs-test-postgres psql -U bstest -d bstest -tAc "${query.replace(/\s*\n\s*/g, ' ').replace(/"/g, '\\"')}"`);
async function call(method, path, { body, token } = {}) {
  const headers = { 'X-Real-IP': '10.70.0.1' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const send = () => fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  // Connexion réutilisée au moment où le serveur la ferme (ECONNRESET) : une seconde tentative suffit.
  const res = await send().catch(() => send());
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}
const minio = new Minio.Client({ endPoint: 'localhost', port: 9010, useSSL: false, accessKey: process.env.BS_MINIO_USER, secretKey: process.env.BS_MINIO_PASS });
const listAll = async (bucket, prefix = '', versions = false) => {
  const out = [];
  const stream = versions ? minio.listObjects(bucket, prefix, true, { IncludeVersion: true }) : minio.listObjectsV2(bucket, prefix, true);
  for await (const item of stream) if (item.name) out.push(item);
  return out;
};

section('Préparation');
const admin = (await call('POST', '/auth/login', { body: { email: 'admin@blackstore.cm', password: process.env.BS_ADMIN_PASSWORD } })).json.accessToken;
check('connexion admin', !!admin);
let r = await call('GET', '/admin/backups');
check('page réservée à l’admin', (await call('GET', '/admin/backups/health')).status === 401 && (await call('POST', '/admin/backups/run')).status === 401);

section('Rattrapage au démarrage (aucune sauvegarde depuis 24 h)');
let status;
for (let i = 0; i < 60; i++) {
  status = (await call('GET', '/admin/backups', { token: admin })).json;
  if (!status.running && status.runs?.some((run) => run.kind === 'retention' && run.trigger === 'startup' && run.status !== 'running')) break;
  await wait(1000);
}
const startupDb = status.runs.find((run) => run.kind === 'database' && run.trigger === 'startup');
check('sauvegarde de rattrapage réussie', startupDb?.status === 'success', startupDb);
check('fichier vérifié, avec empreinte et taille', !!startupDb?.fileName && startupDb.sizeBytes > 1000 && startupDb.sha256?.length === 64 && /tables vérifiées/.test(startupDb.details), startupDb);
check('fichier présent dans le dossier des sauvegardes', !!startupDb && fs.existsSync(path.join(DIR, startupDb.fileName)));
check('copiée hors du serveur', startupDb?.offsite === 'uploaded', startupDb?.offsite);
check('état global : tout va bien', status.healthy === true && status.running === false, { healthy: status.healthy, running: status.running });
check('fichiers protégés par versions (30 jours)', status.files.versioning === 'Enabled' && status.files.keepDays === 30, status.files);
check('copie hors du serveur configurée (destination sans clés)', status.offsite.configured === true && status.offsite.target === 'localhost/bs-offsite', status.offsite);
check('place disque affichée', status.disk?.freeBytes > 0 && status.disk.totalBytes >= status.disk.freeBytes, status.disk);
r = await call('GET', '/admin/backups/health', { token: admin });
check('pastille du menu : santé OK', r.json.healthy === true && !!r.json.lastSuccessAt, r.json);
const remoteBases = await listAll('bs-offsite', 'bases/');
check('copie de la base présente hors du serveur', remoteBases.some((o) => o.name === `bases/${startupDb.fileName}`), remoteBases.map((o) => o.name));

section('La copie se restaure vraiment');
const dumpPath = path.join(DIR, startupDb.fileName);
const toc = docker('exec -i bs-test-postgres pg_restore --list', fs.readFileSync(dumpPath));
const tableCount = Number(sql("select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"));
check('table des matières lisible : toutes les tables de la base', (toc.match(/ TABLE DATA /g) ?? []).length === tableCount, [(toc.match(/ TABLE DATA /g) ?? []).length, tableCount]);
docker(`exec -e PGPASSWORD=${process.env.BS_PG_PASS} bs-test-postgres sh -c "dropdb -U bstest --if-exists restauration && createdb -U bstest restauration"`);
docker(`exec -i -e PGPASSWORD=${process.env.BS_PG_PASS} bs-test-postgres pg_restore -U bstest -d restauration --no-owner`, fs.readFileSync(dumpPath));
const restored = docker(`exec -e PGPASSWORD=${process.env.BS_PG_PASS} bs-test-postgres psql -U bstest -d restauration -tAc "select (select count(*) from products) || '|' || (select count(*) from categories) || '|' || (select count(*) from _prisma_migrations)"`);
const source = sql("select (select count(*) from products) || '|' || (select count(*) from categories) || '|' || (select count(*) from _prisma_migrations)");
check('base restaurée identique (produits, catégories, migrations)', restored === source, [restored, source]);
docker(`exec -e PGPASSWORD=${process.env.BS_PG_PASS} bs-test-postgres dropdb -U bstest restauration`);

section('Conservation : 14 jours, 8 semaines, 6 mois');
const fake = [];
for (let days = 1; days <= 420; days += days < 70 ? 1 : 9) {
  const d = new Date(Date.now() - days * 86_400_000);
  const name = `blackstore-${d.toISOString().slice(0, 10).replace(/-/g, '')}-0230.dump`;
  fs.writeFileSync(path.join(DIR, name), 'ancienne sauvegarde');
  fake.push(name);
}
fs.writeFileSync(path.join(DIR, 'manuelle-avant-mise-a-jour.dump'), 'à ne pas toucher');
const before = fs.readdirSync(DIR).filter((n) => n.startsWith('blackstore-'));
r = await call('POST', '/admin/backups/run', { token: admin });
check('sauvegarde manuelle trop rapprochée : refusée', r.status === 409, [r.status, r.json]);
sql("update backup_runs set started_at = started_at - interval '10 minutes'");
r = await call('POST', '/admin/backups/run', { token: admin });
check('sauvegarde manuelle lancée', r.status === 202 && /lancée/.test(r.json.message), [r.status, r.json]);
r = await call('POST', '/admin/backups/run', { token: admin });
check('deuxième demande pendant la sauvegarde : refusée', r.status === 409, [r.status, r.json]);
for (let i = 0; i < 60; i++) {
  status = (await call('GET', '/admin/backups', { token: admin })).json;
  if (status.runs.filter((run) => run.trigger === 'manual' && run.kind === 'retention' && run.status !== 'running').length >= 1) break;
  await wait(1000);
}
const manualDb = status.runs.find((run) => run.kind === 'database' && run.trigger === 'manual');
check('sauvegarde manuelle réussie', manualDb?.status === 'success', manualDb);
const after = fs.readdirSync(DIR).filter((n) => n.startsWith('blackstore-'));
const expected = backupsToKeep([...before, manualDb.fileName]);
check('fichiers gardés = règle 14 / 8 / 6', after.length === expected.size && after.every((n) => expected.has(n)), { gardés: after.length, attendus: expected.size });
check('au plus 28 copies, dont les 14 derniers jours', after.length <= 28 && after.length >= 14, after.length);
check('la copie manuelle d’avant mise à jour n’est pas touchée', fs.existsSync(path.join(DIR, 'manuelle-avant-mise-a-jour.dump')));
check('liste de l’admin = fichiers gardés', status.database.backups.length === after.length && status.database.backups[0].name === manualDb.fileName, status.database.backups.slice(0, 2));
check('type de conservation indiqué', status.database.backups.some((b) => b.tier === 'mensuelle') && status.database.backups.some((b) => b.tier === 'hebdomadaire'), status.database.backups.map((b) => b.tier));

section('Fichiers : versions et copie hors du serveur');
const bucket = 'bs-test';
await minio.putObject(bucket, `covers/essai-sauvegarde/${Date.now()}.png`, Buffer.from('image v1'));
const coverKey = (await listAll(bucket, 'covers/essai-sauvegarde/'))[0].name;
await minio.removeObject(bucket, coverKey);
const coverVersions = await listAll(bucket, coverKey, true);
check('fichier supprimé : version gardée (récupérable)', coverVersions.some((v) => !v.isDeleteMarker && v.size > 0) && coverVersions.some((v) => v.isDeleteMarker), coverVersions);
await minio.putObject(bucket, 'identity/essai/selfie.jpg', Buffer.from('photo privée'));
await minio.removeObject(bucket, 'identity/essai/selfie.jpg');
check('pièce d’identité supprimée : vraiment effacée', (await listAll(bucket, 'identity/essai/', true)).length === 0);
await minio.putObject(bucket, 'products/essai/guide.pdf', Buffer.from('%PDF-1.4 guide'));
await minio.putObject(bucket, 'identity/essai2/recto.jpg', Buffer.from('recto'));
sql("update backup_runs set started_at = started_at - interval '10 minutes'");
await call('POST', '/admin/backups/run', { token: admin });
for (let i = 0; i < 60; i++) {
  status = (await call('GET', '/admin/backups', { token: admin })).json;
  if (status.runs.filter((run) => run.trigger === 'manual' && run.kind === 'retention' && run.status !== 'running').length >= 2) break;
  await wait(1000);
}
const local = (await listAll(bucket)).map((o) => o.name).sort();
const mirrored = (await listAll('bs-offsite', 'fichiers/')).map((o) => o.name.slice('fichiers/'.length)).sort();
check('miroir hors du serveur identique aux fichiers du site', JSON.stringify(local) === JSON.stringify(mirrored), { local: local.length, miroir: mirrored.length });
await minio.removeObject(bucket, 'identity/essai2/recto.jpg');
sql("update backup_runs set started_at = started_at - interval '10 minutes'");
await call('POST', '/admin/backups/run', { token: admin });
for (let i = 0; i < 60; i++) {
  status = (await call('GET', '/admin/backups', { token: admin })).json;
  if (status.runs.filter((run) => run.trigger === 'manual' && run.kind === 'retention' && run.status !== 'running').length >= 3) break;
  await wait(1000);
}
const filesRun = status.runs.find((run) => run.kind === 'files' && run.trigger === 'manual');
check('pièce d’identité supprimée aussi du miroir', !(await listAll('bs-offsite', 'fichiers/identity/essai2/')).length, filesRun?.details);
check('détail de la copie des fichiers', filesRun?.status === 'success' && /retiré/.test(filesRun.details), filesRun);

section('Données anciennes supprimées (politique de confidentialité)');
const productId = sql("select id from products limit 1");
sql(`insert into support_requests (id, topic, name, email, message, status, created_at, updated_at) values
  ('11111111-1111-4111-8111-111111111111', 'order', 'Ancien', 'ancien@test.local', 'Message traité il y a 3 ans.', 'answered', now() - interval '3 years', now() - interval '3 years'),
  ('22222222-2222-4222-8222-222222222222', 'order', 'Ouvert', 'ouvert@test.local', 'Message jamais traité, ancien.', 'open', now() - interval '3 years', now() - interval '3 years'),
  ('33333333-3333-4333-8333-333333333333', 'order', 'Récent', 'recent@test.local', 'Message traité hier.', 'closed', now() - interval '1 day', now() - interval '1 day')`);
sql(`insert into product_reports (id, product_id, reason, status, resolved_at, created_at) values
  ('44444444-4444-4444-8444-444444444444', '${productId}', 'other', 'dismissed', now() - interval '25 months', now() - interval '26 months')`);
sql(`insert into page_views (id, product_id, created_at) values
  ('55555555-5555-4555-8555-555555555555', '${productId}', now() - interval '14 months'),
  ('66666666-6666-4666-8666-666666666666', '${productId}', now() - interval '2 months')`);
sql("update backup_runs set started_at = started_at - interval '10 minutes'");
await call('POST', '/admin/backups/run', { token: admin });
for (let i = 0; i < 60; i++) {
  status = (await call('GET', '/admin/backups', { token: admin })).json;
  if (status.runs.filter((run) => run.trigger === 'manual' && run.kind === 'retention' && run.status !== 'running').length >= 4) break;
  await wait(1000);
}
const ids = sql("select string_agg(id, ',' order by id) from (select id from support_requests union all select id from product_reports union all select id from page_views) t where id like '1111%' or id like '2222%' or id like '3333%' or id like '4444%' or id like '5555%' or id like '6666%'");
check('message traité il y a 3 ans : supprimé ; non traité et récent : gardés', !ids.includes('11111111') && ids.includes('22222222') && ids.includes('33333333'), ids);
check('signalement traité il y a 2 ans : supprimé', !ids.includes('44444444'), ids);
check('visite de plus de 13 mois : supprimée ; récente : gardée', !ids.includes('55555555') && ids.includes('66666666'), ids);
const retentionRun = status.runs.find((run) => run.kind === 'retention' && run.trigger === 'manual');
check('détail de la purge', retentionRun?.status === 'success' && /1 message\(s\) de contact, 1 signalement\(s\), 1 visite\(s\)/.test(retentionRun.details), retentionRun?.details);

section('Panne de la copie hors du serveur');
for (const o of await listAll('bs-offsite')) await minio.removeObject('bs-offsite', o.name);
await minio.removeBucket('bs-offsite');
sql("update backup_runs set started_at = started_at - interval '10 minutes'");
await call('POST', '/admin/backups/run', { token: admin });
for (let i = 0; i < 60; i++) {
  status = (await call('GET', '/admin/backups', { token: admin })).json;
  if (status.runs.filter((run) => run.trigger === 'manual' && run.kind === 'retention' && run.status !== 'running').length >= 5) break;
  await wait(1000);
}
const brokenDb = status.runs.find((run) => run.kind === 'database' && run.trigger === 'manual');
const brokenFiles = status.runs.find((run) => run.kind === 'files' && run.trigger === 'manual');
check('copie de la base gardée sur le serveur malgré la panne', brokenDb?.status === 'success' && brokenDb.offsite === 'failed' && /n'existe pas/.test(brokenDb.details), brokenDb);
check('échec de la copie des fichiers signalé', brokenFiles?.status === 'failed' && /n'existe pas/.test(brokenFiles.details), brokenFiles);
await minio.makeBucket('bs-offsite');

console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
process.exit(ko ? 1 : 0);
