#!/bin/bash
# Remet à zéro l'état des sauvegardes de test : journal, fichiers, files d'attente Redis, zone « hors du serveur ».
SP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SP/api.env"
export MSYS_NO_PATHCONV=1
docker exec -e PGPASSWORD="$BS_PG_PASS" bs-test-postgres psql -U bstest -d bstest -c "delete from backup_runs; delete from support_requests where id like '1111%' or id like '2222%' or id like '3333%'; delete from product_reports where id like '4444%'; delete from page_views where id like '5555%' or id like '6666%'" >/dev/null
docker exec bs-test-redis redis-cli FLUSHALL >/dev/null
rm -rf "$SP/backups-test"
cd "$SP/../../apps/api" && node -e "
const Minio = require('minio');
const c = new Minio.Client({ endPoint: 'localhost', port: 9010, useSSL: false, accessKey: process.env.BS_MINIO_USER, secretKey: process.env.BS_MINIO_PASS });
(async () => {
  for (const bucket of ['bs-offsite', 'bs-test']) {
    if (!(await c.bucketExists(bucket))) continue;
    const names = [];
    for await (const o of c.listObjects(bucket, '', true, { IncludeVersion: true })) if (o.name) names.push({ name: o.name, versionId: o.versionId });
    for (const o of names) await c.removeObject(bucket, o.name, { versionId: o.versionId });
  }
  if (!(await c.bucketExists('bs-offsite'))) await c.makeBucket('bs-offsite');
  console.log('zones de stockage de test vidées');
})();
"
