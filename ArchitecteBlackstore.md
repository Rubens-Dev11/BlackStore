# PROMPT DE PASSATION — PROJET BLACKSTORE
# Agent suivant : reprends exactement là où l'agent précédent s'est arrêté
# Date : 28 juin 2026

---

## TON RÔLE
Tu es Développeur Senior Full Stack + DevOps expert NestJS, Next.js,
React, Docker, Nginx, Ubuntu. Tu reprends le pilotage du projet BlackStore.
Le porteur du projet s'appelle Rubens.
Lis ce document entièrement avant de produire quoi que ce soit.

---

## RÈGLE ABSOLUE DE TRAVAIL
POUR CHAQUE TÂCHE :
  1. Lire les fichiers ou l'état concerné
  2. Exécuter l'action
  3. Tester et valider
  4. Si ✅ → tâche suivante
  5. Si ❌ → diagnostiquer + corriger + retester
  6. NE JAMAIS passer à la suite sans validation confirmée

---

## CONTEXTE PROJET

### Stack technique
| Couche | Technologie |
|--------|-------------|
| API Backend | NestJS v10 / Node.js 20 |
| ORM | Prisma v5.22 |
| Base de données | PostgreSQL 16 |
| Cache / Queue | Redis 7 + BullMQ 4 |
| Storefront | Next.js 14 App Router |
| Admin Dashboard | React 18 + Vite 5 |
| UI | shadcn/ui + Tailwind CSS v3 |
| Paiement | Tara (taramoney.com) — remplace CinetPay |
| Stockage | MinIO (S3-compatible) |
| Mail dev | MailHog |
| Conteneurisation | Docker + Docker Compose |

### Agrégateur de paiement : TARA (pas CinetPay)
CinetPay a été abandonné. Tara (taramoney.com) est le nouvel agrégateur.
La doc et les clés API seront fournies par Rubens au moment de l'intégration.
NE PAS toucher au module payments avant d'avoir reçu la doc Tara.

---

## INFRASTRUCTURE VPS

| Paramètre | Valeur |
|-----------|--------|
| IP | 102.220.17.199 |
| OS | Ubuntu 24.04.4 LTS |
| RAM | 15.62 GB |
| Disque | 95.82 GB |
| Accès | SSH via MobaXterm |
| User | ubuntu |
| Répertoire projet | /home/ubuntu/blackstore/ |

### Sous-domaines configurés (DNS Hostinger → pymail.cm)
| Sous-domaine | Cible |
|-------------|-------|
| blackstore.pymail.cm | Storefront port 3001 |
| admin.blackstore.pymail.cm | Admin port 3002 |
| api.blackstore.pymail.cm | API port 3000 |

### Services Docker existants sur le VPS (NE PAS TOUCHER)
| Container | Ports exposés |
|-----------|--------------|
| pyramid_mailhog | 127.0.0.1:1025, 127.0.0.1:8025 |
| pyramid_minio | 127.0.0.1:9000-9001 |
| pyramid_postgres | 127.0.0.1:5432 |
| pyramid_redis | 127.0.0.1:6379 |

⚠️ RÈGLE ABSOLUE : BlackStore doit tourner dans un réseau Docker
isolé. Les ports Redis, PostgreSQL, MinIO de BlackStore ne doivent
PAS être exposés à l'hôte (uniquement internes au réseau Docker
blackstore-network). Seuls les ports 3000, 3001, 3002 sont exposés
à localhost pour Nginx.

### Nginx VPS — État actuel
Fichier créé et validé : /etc/nginx/sites-available/blackstore
Symlink créé : /etc/nginx/sites-enabled/blackstore
Test nginx : ✅ syntax ok
Nginx PAS encore rechargé (sudo nginx -s reload pas encore fait)
SSL PAS encore configuré

---

## ÉTAT LOCAL DU PROJET (machine Rubens)

### Services Docker locaux (tous UP)
- nestjs-api : port 3000 ✅
- nextjs-storefront : port 3001 ✅ (avec erreur sonner en dev — voir ci-dessous)
- react-admin : port 3002 ✅ (avec erreur sonner en dev — voir ci-dessous)
- postgres : port 5433 ✅
- redis : port 6379 ✅
- minio : port 9000/9001 ✅
- mailhog : port 1026/8027 ✅

### Problème sonner (DÉPRIORISÉ — ne pas bloquer dessus)
sonner est importé dans :
- apps/storefront/src/app/layout.tsx
- apps/admin/src/App.tsx
Mais le module n'est pas résolu dans les containers Docker.
→ Ce problème est dépriorisé. Si ça bloque le déploiement,
  supprimer l'import sonner et le <Toaster /> de ces deux fichiers
  pour débloquer. Les toasts seront réintégrés après le déploiement.

---

## CE QUI A ÉTÉ FAIT (niveaux 1, 2, 3 terminés)

### Niveau 1 — Quick wins ✅
- Toasts sonner intégrés (bloqués en Docker, dépriorisés)
- Pages 404/500 créées storefront + admin
- Responsive mobile affiné
- Animations de transition Tailwind
- SEO seoTitle/seoDescription + generateMetadata + robots.ts

### Niveau 2 — Fonctionnel ✅
- Export CSV commandes (backend + frontend)
- Upload fichier produit → MinIO
- Validation Zod (checkout storefront + login/produits/catégories admin)
- Formulaire avis acheteur storefront + endpoint POST /reviews

### Niveau 3 — Solidité ✅
- Email confirmation commande avec tokens (MailHog dev)
- Refresh token automatique admin (intercepteur 401 + file d'attente)

---

## TÂCHES RESTANTES — ORDRE STRICT

### TÂCHE 1 — Corriger le problème sonner (BLOQUANT pour déploiement)
Avant de déployer, il faut que les builds soient verts.
Option A — Corriger l'installation sonner dans les containers :
  Dans le répertoire BlackStore sur la machine de Rubens :
  cd apps/storefront && npm install sonner
  cd apps/admin && npm install sonner
  Vérifier que sonner apparaît dans les node_modules
  Rebuilder : docker compose up nextjs-storefront react-admin -d --build
  Tester que localhost:3001 et localhost:3002 chargent sans erreur

Option B — Si Option A échoue, supprimer temporairement sonner :
  Dans apps/storefront/src/app/layout.tsx :
    Supprimer : import { Toaster } from 'sonner'
    Supprimer : <Toaster ... />
  Dans apps/admin/src/App.tsx :
    Supprimer : import { Toaster } from 'sonner'
    Supprimer : <Toaster ... />
  Rebuilder les deux containers
  ✅ Les builds doivent être verts avant de continuer

### TÂCHE 2 — Préparer le projet pour la production
Sur la machine de Rubens, créer apps/storefront/.env.production :
  NEXT_PUBLIC_API_URL=https://api.blackstore.pymail.cm
  NEXT_PUBLIC_SITE_URL=https://blackstore.pymail.cm

Créer apps/admin/.env.production :
  VITE_API_URL=https://api.blackstore.pymail.cm

Créer/vérifier .env.production à la racine :
  NODE_ENV=production
  DATABASE_URL=postgresql://blackstore:MOTDEPASSE_FORT@postgres:5432/blackstore
  REDIS_URL=redis://redis:6379
  JWT_SECRET=GENERER_UN_SECRET_FORT_64_CHARS
  JWT_REFRESH_SECRET=GENERER_UN_AUTRE_SECRET_FORT_64_CHARS
  MINIO_ENDPOINT=minio
  MINIO_PORT=9000
  MINIO_ACCESS_KEY=GENERER_ACCESS_KEY
  MINIO_SECRET_KEY=GENERER_SECRET_KEY
  MINIO_BUCKET=products
  SMTP_HOST=localhost
  SMTP_PORT=1025
  NEXT_PUBLIC_API_URL=https://api.blackstore.pymail.cm
  NEXT_PUBLIC_SITE_URL=https://blackstore.pymail.cm
  CORS_ORIGINS=https://blackstore.pymail.cm,https://admin.blackstore.pymail.cm

Créer docker-compose.prod.yml à la racine :
  Même structure que docker-compose.yml MAIS :
  - postgres, redis, minio : PAS de ports exposés à l'hôte
    (uniquement accessibles via le réseau Docker interne)
  - nestjs-api : expose 3000:3000
  - nextjs-storefront : expose 3001:3001
  - react-admin : expose 3002:3002
  - Tous les services dans le même réseau : blackstore-network
  - Utiliser les variables depuis .env.production

### TÂCHE 3 — Déployer sur le VPS
Sur le VPS (MobaXterm), dans /home/ubuntu/blackstore/ :

Méthode : transfert via Git ou rsync depuis la machine de Rubens.

Si Git (recommandé) :
  Sur le VPS :
    cd /home/ubuntu/blackstore
    git clone <URL_REPO> .
  Ou si déjà cloné :
    git pull origin main

Si rsync (alternative) :
  Depuis la machine de Rubens (PowerShell) :
    rsync -avz --exclude node_modules --exclude .git \
      /chemin/local/BlackStore/ \
      ubuntu@102.220.17.199:/home/ubuntu/blackstore/

Ensuite sur le VPS :
  cd /home/ubuntu/blackstore
  docker compose -f docker-compose.prod.yml up -d --build
  docker compose -f docker-compose.prod.yml ps
  docker compose -f docker-compose.prod.yml logs nestjs-api --tail=50

Vérifier que les 3 services principaux répondent :
  curl http://localhost:3000/health
  curl http://localhost:3001
  curl http://localhost:3002

### TÂCHE 4 — Recharger Nginx et configurer SSL
Sur le VPS :

  # Recharger Nginx
  sudo nginx -s reload

  # Vérifier que les domaines répondent en HTTP
  curl -I http://blackstore.pymail.cm
  curl -I http://admin.blackstore.pymail.cm
  curl -I http://api.blackstore.pymail.cm

  # Générer les certificats SSL
  sudo certbot --nginx \
    -d blackstore.pymail.cm \
    -d admin.blackstore.pymail.cm \
    -d api.blackstore.pymail.cm \
    --non-interactive \
    --agree-tos \
    -m rubens@email.com

  # Vérifier HTTPS
  curl -I https://blackstore.pymail.cm

### TÂCHE 5 — Migration Prisma en production
Sur le VPS :
  docker compose -f docker-compose.prod.yml exec nestjs-api \
    npx prisma migrate deploy
  
  # Créer l'admin initial si pas de seed
  docker compose -f docker-compose.prod.yml exec nestjs-api \
    npx prisma db seed

### TÂCHE 6 — Intégration Tara (après que Rubens fournit la doc)
⚠️ NE PAS commencer cette tâche sans :
  1. La documentation API Tara fournie par Rubens
  2. Les clés API Tara (sandbox d'abord)
  3. Le site déployé et accessible en HTTPS
     (Tara a besoin d'une notify_url publique réelle)

Quand Rubens fournit la doc :
  Lire entièrement la doc Tara avant d'écrire une ligne de code
  Adapter apps/api/src/modules/payments/payments.service.ts
  Adapter apps/api/src/modules/payments/payments.controller.ts
  Mettre à jour le .env.production avec les clés Tara
  Tester le flux complet sandbox

---

## RÈGLES ABSOLUES PROJET

1. @blackstore/shared → JAMAIS → toujours @/lib/format
2. GET /products → sans query params → réponse { data: [], total: N }
3. docker --build → UNIQUEMENT si package.json ou Dockerfile modifié
4. Noms services → nestjs-api, nextjs-storefront, react-admin
5. TypeScript strict → useState<Type | null>(null) toujours
6. Ports locaux → 5433 (postgres), 8027 (mailhog) — ne pas changer
7. Sur VPS → postgres/redis/minio JAMAIS exposés à l'hôte
8. NE PAS toucher aux containers pyramid_* sur le VPS
9. Champs Prisma → section schéma = source de vérité
10. Une modification → un test → validation avant de continuer

---

## IDENTIFIANTS

Admin local : admin@blackstore.cm / Admin@BlackStore2026!

| Service local | URL |
|--------------|-----|
| API + Swagger | http://localhost:3000/docs |
| Storefront | http://localhost:3001 |
| Admin | http://localhost:3002 |
| MailHog | http://localhost:8027 |
| MinIO | http://localhost:9001 |

| Service prod (cible) | URL |
|--------------------|-----|
| Storefront | https://blackstore.pymail.cm |
| Admin | https://admin.blackstore.pymail.cm |
| API | https://api.blackstore.pymail.cm |

---

## RAPPORT ATTENDU À LA FIN
- ✅/❌ Problème sonner résolu
- ✅/❌ Builds locaux verts
- ✅/❌ Déploiement VPS OK
- ✅/❌ Nginx rechargé
- ✅/❌ SSL configuré (3 domaines)
- ✅/❌ Migration Prisma prod
- ✅/❌ https://blackstore.pymail.cm accessible
- ✅/❌ https://admin.blackstore.pymail.cm accessible
- ✅/❌ https://api.blackstore.pymail.cm accessible
- Liste des fichiers créés/modifiés

---
Document de passation généré le 28 juin 2026
Projet : BlackStore v2.0 — Marché Cameroun & Afrique
Porteur : Rubens
État : Niveaux 1+2+3 ✅ | VPS Nginx ✅ | SSL ⏳ | Déploiement ⏳ | Tara ⏳