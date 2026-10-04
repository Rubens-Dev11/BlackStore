#!/usr/bin/env bash
# Installe la page de maintenance de BlackStore dans Nginx (serveur de production).
# Nginx l'affiche, avec le code 503, quand le site, l'admin ou l'API ne répondent pas
# (redémarrage pendant une mise à jour), à la place de « 502 Bad Gateway ».
#
# À lancer sur le serveur, depuis ~/blackstore :  bash docker/nginx/installer-pages-erreur.sh
# Le relancer met seulement la page à jour : la configuration n'est modifiée qu'une fois.
# En cas de configuration refusée par « nginx -t », l'ancienne est remise en place.
set -euo pipefail
cd "$(dirname "$0")"

SUDO="sudo -n"
SITE="${NGINX_SITE:-/etc/nginx/sites-available/blackstore}"
WEB_DIR=/var/www/blackstore-erreurs
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups-blackstore}"
MARK=_blackstore_maintenance

$SUDO test -f "$SITE" || { echo "Configuration Nginx introuvable : $SITE"; exit 1; }

$SUDO install -d -m 755 "$WEB_DIR"
$SUDO install -m 644 maintenance.html "$WEB_DIR/$MARK.html"
echo "Page de maintenance copiée dans $WEB_DIR."

if $SUDO grep -q "$MARK" "$SITE"; then
  echo "La configuration Nginx contient déjà la page de maintenance : rien d'autre à faire."
  exit 0
fi

mkdir -p "$BACKUP_DIR"
backup="$BACKUP_DIR/nginx-blackstore-$(date +%Y%m%d-%H%M%S).conf"
$SUDO cp -p "$SITE" "$backup"
echo "Copie de la configuration actuelle : $backup"

# Le bloc est ajouté dans chaque serveur HTTPS (site, admin, API), juste avant « listen 443 ».
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
$SUDO cat "$SITE" | awk 'NR == FNR { snippet = snippet $0 "\n"; next } /^[[:space:]]*listen 443 ssl;/ { printf "%s", snippet } { print }' pages-erreur.conf - > "$tmp"
added=$(grep -c "error_page 502 503 504 =503 /$MARK.html;" "$tmp" || true)
if [ "$added" -lt 1 ]; then
  echo "Aucun serveur HTTPS trouvé dans $SITE : configuration laissée telle quelle."
  exit 1
fi

$SUDO cp "$tmp" "$SITE"
if $SUDO nginx -t; then
  $SUDO systemctl reload nginx
  echo "Page de maintenance active sur $added serveur(s)."
else
  $SUDO cp -p "$backup" "$SITE"
  echo "Configuration refusée par Nginx : l'ancienne a été remise en place."
  exit 1
fi
