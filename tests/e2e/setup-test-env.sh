#!/bin/bash
# Environnement de test local BlackStore : secrets aléatoires, conteneurs (label bs-test=1), migrations, seed.
# Usage : bash setup-test-env.sh   (puis lancer l'API avec : . api.env ; node dist/src/main.js)
set -e
SP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SP/../../apps/api"
rnd() { node -e "console.log(require('crypto').randomBytes($1).toString('hex'))"; }

cat > "$SP/test.env" <<EOF
export BS_PG_PASS=$(rnd 12)
export BS_MINIO_USER=bstest$(rnd 3)
export BS_MINIO_PASS=$(rnd 16)
export BS_JWT_SECRET=$(rnd 32)
export BS_JWT_REFRESH_SECRET=$(rnd 32)
export BS_ADMIN_PASSWORD=Adm$(rnd 8)!
EOF
cat > "$SP/api.env" <<'EOF'
. "$(dirname "${BASH_SOURCE[0]}")/test.env"
export NODE_ENV=development APP_PORT=3100
export DATABASE_URL="postgresql://bstest:${BS_PG_PASS}@localhost:5434/bstest"
export REDIS_URL="redis://localhost:6380" REDIS_HOST=localhost REDIS_PORT=6380
export JWT_SECRET="$BS_JWT_SECRET" JWT_REFRESH_SECRET="$BS_JWT_REFRESH_SECRET"
export MINIO_ENDPOINT=localhost MINIO_PORT=9010 MINIO_USE_SSL=false MINIO_ACCESS_KEY="$BS_MINIO_USER" MINIO_SECRET_KEY="$BS_MINIO_PASS" MINIO_BUCKET=bs-test MINIO_PUBLIC_URL=http://localhost:9010
export SMTP_HOST=127.0.0.1 SMTP_PORT=1027 SMTP_USER= SMTP_PASS= SMTP_FROM="BlackStore Test <noreply@test.local>"
export API_PUBLIC_URL=http://localhost:3100 SELLER_APP_URL=http://localhost:3002 STOREFRONT_URL=http://localhost:3001 BCRYPT_SALT_ROUNDS=10
export CLAMAV_HOST=localhost CLAMAV_PORT=3310
export CINETPAY_API_URL=http://localhost:3998 CINETPAY_API_KEY=test CINETPAY_SITE_ID=test CINETPAY_CURRENCY=XAF CINETPAY_NOTIFY_URL=http://localhost:3100/payments/notify CINETPAY_RETURN_URL=http://localhost:3001/commande/succes
export ADMIN_SEED_EMAIL=admin@blackstore.cm ADMIN_SEED_PASSWORD="$BS_ADMIN_PASSWORD"
export BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && (pwd -W 2>/dev/null || pwd))/backups-test" BACKUP_PG_DOCKER_CONTAINER=bs-test-postgres BACKUP_STARTUP_DELAY_MS=4000
export BACKUP_S3_URL=http://localhost:9010 BACKUP_S3_BUCKET=bs-offsite BACKUP_S3_ACCESS_KEY="$BS_MINIO_USER" BACKUP_S3_SECRET_KEY="$BS_MINIO_PASS"
EOF

. "$SP/api.env"
export MSYS_NO_PATHCONV=1
docker ps -aq --filter label=bs-test=1 | xargs -r docker rm -f -v >/dev/null
docker run -d --name bs-test-postgres --label bs-test=1 -p 127.0.0.1:5434:5432 -e POSTGRES_USER=bstest -e POSTGRES_PASSWORD="$BS_PG_PASS" -e POSTGRES_DB=bstest postgres:16-alpine >/dev/null
docker run -d --name bs-test-redis --label bs-test=1 -p 127.0.0.1:6380:6379 redis:7-alpine >/dev/null
docker run -d --name bs-test-minio --label bs-test=1 -p 127.0.0.1:9010:9000 -e MINIO_ROOT_USER="$BS_MINIO_USER" -e MINIO_ROOT_PASSWORD="$BS_MINIO_PASS" minio/minio:latest server /data >/dev/null
docker run -d --name bs-test-mailhog --label bs-test=1 -p 127.0.0.1:1027:1025 -p 127.0.0.1:8028:8025 mailhog/mailhog:latest >/dev/null
for i in $(seq 1 30); do docker exec bs-test-postgres pg_isready -U bstest >/dev/null 2>&1 && break; sleep 1; done

cd "$API_DIR"
npx --no-install prisma migrate deploy 2>&1 | grep -E "Applying|rror" || true
npx --no-install prisma db seed 2>&1 | grep -E "terminé|rror" || true
# Les produits de démo du seed sont inactifs : on les met en ligne pour les essais.
docker exec -e PGPASSWORD="$BS_PG_PASS" bs-test-postgres psql -U bstest -d bstest -c "update products set is_active = true" >/dev/null
docker ps --filter label=bs-test=1 --format '{{.Names}} {{.Status}}'
echo "environnement de test prêt"
