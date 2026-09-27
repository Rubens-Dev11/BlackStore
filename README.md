# BlackStore

Boutique en ligne de produits numériques (applications Android, logiciels, fichiers à télécharger) pour le marché africain : commande en quelques clics, livraison automatique et sécurisée des fichiers, back-office complet.

**En ligne :** [blackstore.pymail.cm](https://blackstore.pymail.cm)

## Fonctionnalités

### Boutique
- Catalogue avec filtre par catégorie ; les produits mis en avant apparaissent en premier.
- Fiche produit : captures d'écran, vidéo de démonstration, guide d'installation, note des clients et nombre de téléchargements.
- Panier et commande sans création de compte (nom, e-mail, téléphone).
- Produits gratuits : commande validée immédiatement. Produits payants : paiement en ligne via CinetPay (Mobile Money et carte), en cours de mise en service.
- Livraison sécurisée : chaque achat donne un lien de téléchargement personnel, limité dans le temps (72 h par défaut) et en nombre de téléchargements (3 par défaut), sur la page de confirmation et par e-mail.

### Administration
- Tableau de bord et statistiques : ventes, visites, provenance des visiteurs.
- Produits : création, envoi du fichier, de l'image de couverture et des captures avec barre de progression, mise en avant, activation.
- Catégories, commandes (renvoi des liens, remboursement, export CSV) et avis clients.
- Mon compte : changement du mot de passe administrateur.

## Architecture

Monorepo npm (workspaces) :

| Dossier | Rôle | Technologies |
|---|---|---|
| `apps/api` | API REST | NestJS 10, Prisma 5, PostgreSQL, Redis, MinIO, Nodemailer |
| `apps/storefront` | Boutique publique | Next.js 14 (App Router), React 18, Tailwind CSS |
| `apps/admin` | Back-office | React 18, Vite 5, Tailwind CSS, TanStack Query |
| `packages/shared` | Types partagés | TypeScript |

## Démarrer en local

Prérequis : Docker Desktop, Node.js 20 et Git.

```bash
git clone https://github.com/Rubens-Dev11/BlackStore.git
cd BlackStore
cp .env.example .env
```

Complétez ensuite `.env` : secrets JWT, accès MinIO, clés de paiement et mot de passe de l'administrateur initial (`ADMIN_SEED_PASSWORD`, 12 caractères minimum).

```bash
npm install
docker compose up --build
```

| Service | Adresse |
|---|---|
| Boutique | http://localhost:3001 |
| Administration | http://localhost:3002 |
| API (documentation sur `/docs`) | http://localhost:3000 |
| Console MinIO (fichiers) | http://localhost:9001 |
| MailHog (e-mails de test) | http://localhost:8027 |

Au premier démarrage, créez les tables et les données initiales :

```bash
docker compose exec nestjs-api npx prisma migrate dev
docker compose exec nestjs-api npx prisma db seed
```

Le seed crée l'administrateur (`ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`), trois catégories et deux produits de démonstration.

## Production

BlackStore tourne sur un VPS avec Docker Compose (`docker-compose.prod.yml`), derrière Nginx et des certificats Let's Encrypt. Les secrets sont dans `.env.production`, qui n'est jamais versionné.

```bash
docker compose -p blackstore --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## Feuille de route

- Paiement Mobile Money et carte via la nouvelle API CinetPay.
- Marketplace : permettre à d'autres vendeurs de créer un compte et de vendre leurs propres produits numériques sur BlackStore, avec une commission pour la plateforme (en conception).
