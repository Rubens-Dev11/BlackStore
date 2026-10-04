# Sauvegardes de BlackStore

L'API fait chaque nuit à 2 h 30 (heure du Cameroun) une maintenance automatique, visible dans l'admin (page « Sauvegardes ») :

| Quoi | Comment | Où |
| --- | --- | --- |
| Base de données | `pg_dump` vérifié par `pg_restore --list`, gardé 14 jours, 8 semaines et 6 mois | serveur : `~/backups-blackstore/auto/base/` |
| Fichiers du site | versions MinIO : un fichier supprimé ou remplacé reste récupérable 30 jours (sauf `identity/`, effacé tout de suite) | bucket `blackstore` |
| Copie hors du serveur | si `BACKUP_S3_*` est configuré : la base dans `bases/`, un miroir des fichiers dans `fichiers/` | stockage compatible S3 |
| Données anciennes | messages et signalements traités depuis 2 ans, visites de plus de 13 mois | base de données |

Une sauvegarde manquée (serveur arrêté la nuit) est rattrapée au redémarrage de l'API. Un échec est signalé dans l'admin et par e-mail à l'adresse de contact des réglages.

Gardez aussi, hors du serveur, une copie des fichiers `.env.production` (dans un gestionnaire de mots de passe) : ils contiennent les secrets nécessaires pour tout reconstruire.

## Activer la copie hors du serveur

1. Créez un compte de stockage compatible S3 (par exemple Backblaze B2, 10 Go gratuits), un compartiment privé et une clé limitée à ce compartiment.
2. Sur le serveur, depuis `~/blackstore` : `bash docker/backup/configurer-copie-externe.sh`, puis répondez aux questions.

## Restaurer la base

Toujours sauvegarder l'état actuel avant de restaurer, puis restaurer la copie choisie :

```bash
cd ~/blackstore
DC="sudo docker compose -p blackstore --env-file .env.production -f docker-compose.prod.yml"
sudo docker exec blackstore-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > ~/backups-blackstore/avant-restauration.dump
$DC stop nestjs-api
sudo cat ~/backups-blackstore/auto/base/blackstore-AAAAMMJJ-HHMM.dump \
  | sudo docker exec -i blackstore-postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner'
$DC start nestjs-api
```

Pour vérifier une copie sans toucher à la production, restaurez-la dans un conteneur temporaire (`postgres:16-alpine`) et comparez le nombre de produits.

## Récupérer un fichier supprimé (moins de 30 jours)

Les versions se consultent avec le client MinIO (`mc ls --versions`) ; une ancienne version se récupère avec `mc cp --version-id`. Les pièces d'identité ne sont pas versionnées : leur suppression est définitive, comme le prévoit la politique de confidentialité.
