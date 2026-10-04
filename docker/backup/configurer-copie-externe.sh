#!/usr/bin/env bash
# Active la copie des sauvegardes hors du serveur (stockage compatible S3 : Backblaze B2, Cloudflare R2…).
# À lancer sur le serveur, depuis le dossier ~/blackstore :  bash docker/backup/configurer-copie-externe.sh
# Les clés sont tapées par vous : elles ne s'affichent pas et ne quittent pas le serveur.
set -euo pipefail
cd "$(dirname "$0")/../.."
ENV_FILE="${ENV_FILE:-.env.production}"
[ -f "$ENV_FILE" ] || { echo "Fichier $ENV_FILE introuvable : lancez ce script depuis le dossier blackstore du serveur."; exit 1; }

echo "Copie des sauvegardes hors du serveur"
echo "Les valeurs se trouvent dans votre espace de stockage (par exemple Backblaze B2 : Buckets et Application Keys)."
read -rp "Adresse S3 (ex. https://s3.eu-central-003.backblazeb2.com) : " url
read -rp "Région (ex. eu-central-003) : " region
read -rp "Nom du compartiment (bucket) : " bucket
read -rp "Identifiant de la clé (keyID) : " key
read -rsp "Clé secrète (applicationKey, elle ne s'affiche pas) : " secret
echo
case "$url" in https://*) ;; *) echo "L'adresse doit commencer par https://"; exit 1 ;; esac
for value in "$region" "$bucket" "$key" "$secret"; do
  [ -n "$value" ] || { echo "Un des champs est vide : rien n'a été modifié."; exit 1; }
done

cp -p "$ENV_FILE" "$ENV_FILE.bak-$(date +%Y%m%d-%H%M%S)"
grep -v '^BACKUP_S3_' "$ENV_FILE" > "$ENV_FILE.tmp" || true
{
  echo "BACKUP_S3_URL=$url"
  echo "BACKUP_S3_REGION=$region"
  echo "BACKUP_S3_BUCKET=$bucket"
  echo "BACKUP_S3_ACCESS_KEY=$key"
  echo "BACKUP_S3_SECRET_KEY=$secret"
} >> "$ENV_FILE.tmp"
chmod 600 "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
echo "Réglages enregistrés (copie de l'ancien fichier gardée à côté)."

if [ "${NO_RESTART:-}" != "1" ]; then
  sudo docker compose -p blackstore --env-file "$ENV_FILE" -f docker-compose.prod.yml up -d --no-deps --no-build nestjs-api
  echo "C'est fait : la copie se fera cette nuit, ou tout de suite avec « Sauvegarder maintenant » dans l'admin (page Sauvegardes)."
fi
