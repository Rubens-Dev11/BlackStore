# BlackStore — Plateforme de Vente de Produits Numériques

Plateforme e-commerce mono-vendeur spécialisée dans la vente et la distribution automatisée de produits numériques (APK, Logiciels Desktop, ZIP) pour le marché africain, avec paiement via CinetPay.

## Démarrage rapide

### Prérequis
- Docker Desktop installé
- Git

### Installation
```bash
git clone <repo>
cd blackstore
cp .env.example .env
npm install
```
*Note : Éditer le fichier `.env` avec vos vraies clés API (CinetPay, etc).*

### Démarrer tout l'environnement (Phase 1)
```bash
docker compose up --build
```
*Cette commande va builder et lancer l'ensemble des 7 services.*

### Accès aux services (Développement)
| Service          | URL                        | Description |
|------------------|----------------------------|-------------|
| Storefront       | http://localhost:3001      | Next.js App Router (Boutique publique) |
| Admin Dashboard  | http://localhost:3002      | React + Vite (Gestion privée) |
| API NestJS       | http://localhost:3000      | Backend |
| API Swagger      | http://localhost:3000/docs | Documentation de l'API |
| PostgreSQL       | localhost:5432             | Base de données |
| Redis            | localhost:6379             | Cache et Queues |
| MinIO Console    | http://localhost:9001      | Panneau de gestion du stockage (identifiants dans `.env`) |
| MailHog          | http://localhost:8025      | Serveur SMTP local (Emails) |

### Initialiser la base de données (première fois)

Une fois les conteneurs démarrés, ouvrez un autre terminal et exécutez la migration et le seed initial :

```bash
docker compose exec nestjs-api npx prisma migrate dev --name init
docker compose exec nestjs-api npx prisma db seed
```

### Connexion admin par défaut
- **Email** : `admin@blackstore.cm`
- **Mot de passe** : `Admin@BlackStore2026!`

## Architecture — Monorepo (npm workspaces)

- `apps/api` : Backend **NestJS v10** (PostgreSQL avec Prisma, Redis avec BullMQ)
- `apps/storefront` : Frontend client en **Next.js 14 App Router** (TailwindCSS, Zustand)
- `apps/admin` : Frontend administrateur en **React 18 + Vite 5** (TailwindCSS)
- `packages/shared` : Types TypeScript et configurations partagées
