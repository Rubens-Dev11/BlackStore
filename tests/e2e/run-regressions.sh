#!/bin/bash
# Rejoue tous les essais de bout en bout de BlackStore sur l'environnement de test local.
# Usage : bash run-regressions.sh   (journal complet dans regressions.log)
SP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SP/api.env"
export MSYS_NO_PATHCONV=1
cd "$SP"

kill_port() {
  powershell.exe -NoProfile -Command "\$p = (Get-NetTCPConnection -LocalPort $1 -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique; if (\$p) { Stop-Process -Id \$p -Force }" >/dev/null 2>&1
}
start_api() {
  (cd "$SP/../../apps/api" && bash -c ". '$SP/api.env'; exec node dist/src/main.js" >> "$SP/api.log" 2>&1 &)
  for i in $(seq 1 60); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/categories)" = 200 ] && return 0
    sleep 1
  done
  echo "API non démarrée"
  return 1
}
sql() { docker exec -e PGPASSWORD="$BS_PG_PASS" bs-test-postgres psql -U bstest -d bstest -tAc "$1"; }
run() {
  echo "===== $1" | tee -a regressions.log
  timeout 1200 node "$1.mjs" "${@:2}" >> regressions.log 2>&1
  local code=$?
  grep -aE "vérifications réussies|^Résultat :" regressions.log | tail -1 | sed "s/^/$1 : /" | tee -a resume.txt
  [ $code -eq 0 ] || echo "$1 : ÉCHEC (code $code)" | tee -a resume.txt
}

: > regressions.log
: > resume.txt
kill_port 3100
start_api || exit 1

run e2e-sellers; sleep 65
run e2e-stores; sleep 65
# L'essai des boutiques rattache le produit de démo à une boutique : on le détache pour les suivants.
sql "update products set store_id = null where slug = 'app-demo-android-v1'" >/dev/null
for s in e2e-products e2e-reports e2e-identity e2e-wallet e2e-video e2e-legal; do
  run "$s"
  sleep 65
done

# Sauvegardes : état remis à zéro puis API relancée (le rattrapage au démarrage fait partie de l'essai).
kill_port 3100
bash reset-backups.sh >/dev/null 2>&1
start_api || exit 1
run e2e-backups

run e2e-errors
sleep 65
run e2e-disputes
run e2e-client
run e2e-admin-password
run e2e-promo
run e2e-stats

# Antivirus arrêté : le faux clamd est coupé le temps de l'essai.
seller=$(sql "select s.email from sellers s join stores st on st.seller_id = s.id join products p on p.store_id = st.id where p.name = 'Modèles gratuits' limit 1")
kill_port 3310
run e2e-antivirus-down "$seller"
(node fake-clamd.mjs > clamd.log 2>&1 &)

echo "----- résumé"
cat resume.txt
