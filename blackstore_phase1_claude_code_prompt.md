# PROMPT CLAUDE CODE — BLACKSTORE PHASE 1 : FONDATION & INFRASTRUCTURE

---

## Contexte produit

BlackStore est une plateforme e-commerce **mono-vendeur** spécialisée dans la vente et
distribution automatisée de produits numériques (APK Android, logiciels Desktop, ZIP) ciblant
le marché africain — Cameroun en priorité. Un administrateur unique gère le catalogue via un
dashboard privé. Le paiement se fait via **CinetPay** (Orange Money, MTN Mobile Money, Visa/
Mastercard). La livraison est automatisée : dès confirmation du paiement, des tokens de
téléchargement sécurisés sont générés et affichés immédiatement sur la page de succès.

---

## Rôle de l'agent

Agis comme un **Architecte Full Stack Senior** expert en NestJS, Next.js 14 App Router, Prisma,
PostgreSQL et Docker Compose. Tu maîtrises la Clean Architecture, les monorepos Node.js, les
environnements de développement 100% containerisés, et les bonnes pratiques de sécurité
(OWASP, Secure by Design).

---

## Objectif — Phase 1 : Fondation & Infrastructure (Semaines 1–2)

Mettre en place la structure complète du projet BlackStore :

1. Un **monorepo Node.js** (npm workspaces) avec 3 applications indépendantes
2. Un `docker-compose.yml` complet pour l'environnement de développement (**7 services**)
3. Le **schéma Prisma complet** avec toutes les entités métier
4. Les **squelettes NestJS** avec tous les modules déclarés et configurés
5. Les projets **Next.js 14** et **React/Vite** initialisés avec Tailwind + shadcn/ui
6. Toutes les **variables d'environnement** documentées
7. Un **seed** de données de test
8. Les **Dockerfiles** pour chaque application

À la fin, une seule commande `docker compose up --build` doit démarrer l'intégralité de
l'environnement de développement sans aucune installation manuelle.

---

## Structure du monorepo

```
blackstore/
├── apps/
│   ├── api/                  # NestJS v10+ — port 3000
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── storefront/           # Next.js 14 App Router — port 3001
│   │   ├── src/app/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── admin/                # React 18 + Vite 5 — port 3002
│       ├── src/
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/               # Types TypeScript partagés (DTOs, interfaces, enums)
│       ├── src/
│       │   ├── types/
│       │   └── index.ts
│       └── package.json
├── docker-compose.yml
├── docker-compose.prod.yml   # Override production (squelette)
├── .env.example
├── .gitignore
├── package.json              # Workspace root
└── README.md
```

---

## Contraintes techniques strictes

### Monorepo
- **npm workspaces** uniquement (pas Turborepo, pas Nx — garder simple)
- TypeScript `strict: true` dans tous les `tsconfig.json`
- Pas de `any` implicite — erreur de compilation si utilisé

### API (apps/api)
- NestJS **v10+**, Node.js **20 LTS**, TypeScript strict
- **Prisma v5+** comme seul ORM (jamais TypeORM, jamais Sequelize)
- `@nestjs/jwt` + Passport pour l'authentification JWT
- `class-validator` + `class-transformer` pour **tous** les DTOs entrants
- `@nestjs/swagger` pour la documentation auto-générée (désactivée en production)
- `multer` pour les uploads de fichiers (APK, EXE, ZIP, images)
- `nodemailer` pour les emails
- `bullmq` + Redis pour les queues asynchrones
- `helmet` pour la sécurité des headers HTTP
- `bcrypt` avec salt factor 12 minimum
- `@nestjs/config` avec validation des variables d'environnement (zod ou Joi)

### Storefront (apps/storefront)
- **Next.js 14 App Router** uniquement (jamais Pages Router)
- TypeScript strict, Tailwind CSS v3, shadcn/ui
- **TanStack Query v5** pour le data fetching
- **Zustand v4** pour le state global
- `next/image` pour l'optimisation des images

### Admin (apps/admin)
- **React 18 + Vite 5**, TypeScript strict
- Tailwind CSS v3, shadcn/ui
- TanStack Query v5, Zustand v4
- **Recharts v2** pour les graphiques analytics
- **TipTap v2** pour l'éditeur rich text (description produit)

### Infrastructure
- **PostgreSQL 16** (JSONB et ARRAY natifs requis)
- **Redis 7** + BullMQ 4
- **MinIO** (stockage S3-compatible en dev, migration S3/R2 en production)
- **MailHog** (serveur SMTP fictif — voir les emails sans les envoyer)

---

## Schéma Prisma complet à implémenter

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// CATÉGORIE
// ─────────────────────────────────────────────
model Category {
  id          String    @id @default(uuid())
  name        String    @db.VarChar(100)
  slug        String    @unique @db.VarChar(100)
  description String?   @db.Text
  iconUrl     String?   @db.VarChar(500) @map("icon_url")
  isActive    Boolean   @default(true)   @map("is_active")
  sortOrder   Int       @default(0)      @map("sort_order")
  products    Product[]
  createdAt   DateTime  @default(now())  @map("created_at")
  updatedAt   DateTime  @updatedAt       @map("updated_at")

  @@map("categories")
}

// ─────────────────────────────────────────────
// PRODUIT
// ─────────────────────────────────────────────
enum Platform {
  android
  desktop
  multiplatform
}

model Product {
  id                  String      @id @default(uuid())
  name                String      @db.VarChar(255)
  slug                String      @unique @db.VarChar(255)
  shortDescription    String?     @db.Text          @map("short_description")
  description         String?     @db.Text
  coverImageUrl       String?     @db.VarChar(500)  @map("cover_image_url")
  screenshots         String[]
  demoVideoUrl        String?     @db.VarChar(500)  @map("demo_video_url")
  installGuide        String?     @db.Text          @map("install_guide")
  installVideoUrl     String?     @db.VarChar(500)  @map("install_video_url")
  price               Int                           // Prix en FCFA (XAF)
  originalPrice       Int?                          @map("original_price")
  categoryId          String?                       @map("category_id")
  category            Category?   @relation(fields: [categoryId], references: [id])
  tags                String[]
  version             String?     @db.VarChar(20)
  fileSizeMb          Decimal?    @db.Decimal(10, 2) @map("file_size_mb")
  platform            Platform    @default(android)
  minRequirements     Json?                         @map("min_requirements")
  changelog           Json?
  filePath            String?     @db.VarChar(500)  @map("file_path")
  fileHash            String?     @db.VarChar(64)   @map("file_hash")
  maxDownloads        Int         @default(3)        @map("max_downloads")
  downloadExpiryHours Int         @default(72)       @map("download_expiry_hours")
  downloadCount       Int         @default(0)        @map("download_count")
  viewCount           Int         @default(0)        @map("view_count")
  ratingAvg           Decimal     @default(0) @db.Decimal(3, 2) @map("rating_avg")
  ratingCount         Int         @default(0)        @map("rating_count")
  isActive            Boolean     @default(false)    @map("is_active")
  isFeatured          Boolean     @default(false)    @map("is_featured")
  seoTitle            String?     @db.VarChar(70)   @map("seo_title")
  seoDescription      String?     @db.VarChar(160)  @map("seo_description")
  orderItems          OrderItem[]
  reviews             Review[]
  pageViews           PageView[]
  createdAt           DateTime    @default(now())    @map("created_at")
  updatedAt           DateTime    @updatedAt         @map("updated_at")

  @@map("products")
}

// ─────────────────────────────────────────────
// COMMANDE
// ─────────────────────────────────────────────
enum OrderStatus {
  pending
  paid
  failed
  refunded
}

enum PaymentMethod {
  orange_money
  mtn_mobile_money
  card
}

model Order {
  id               String         @id @default(uuid())
  orderNumber      String         @unique                @map("order_number")
  buyerName        String         @db.VarChar(100)       @map("buyer_name")
  buyerEmail       String         @db.VarChar(150)       @map("buyer_email")
  buyerPhone       String?        @db.VarChar(20)        @map("buyer_phone")
  totalAmount      Int                                   @map("total_amount")
  currency         String         @default("XAF") @db.VarChar(3)
  status           OrderStatus    @default(pending)
  paymentMethod    PaymentMethod?                        @map("payment_method")
  // CinetPay transaction_id — utilisé pour l'idempotence et la vérification
  paymentReference String?        @db.VarChar(255)       @map("payment_reference")
  utmSource        String?        @db.VarChar(100)       @map("utm_source")
  utmMedium        String?        @db.VarChar(100)       @map("utm_medium")
  utmCampaign      String?        @db.VarChar(100)       @map("utm_campaign")
  utmContent       String?        @db.VarChar(100)       @map("utm_content")
  referrerUrl      String?        @db.Text               @map("referrer_url")
  items            OrderItem[]
  createdAt        DateTime       @default(now())        @map("created_at")
  paidAt           DateTime?                             @map("paid_at")
  updatedAt        DateTime       @updatedAt             @map("updated_at")

  @@map("orders")
}

// ─────────────────────────────────────────────
// ITEM DE COMMANDE
// ─────────────────────────────────────────────
model OrderItem {
  id              String          @id @default(uuid())
  orderId         String                               @map("order_id")
  order           Order           @relation(fields: [orderId], references: [id])
  productId       String                               @map("product_id")
  product         Product         @relation(fields: [productId], references: [id])
  priceAtPurchase Int                                  @map("price_at_purchase")
  downloadTokens  DownloadToken[]
  createdAt       DateTime        @default(now())      @map("created_at")

  @@map("order_items")
}

// ─────────────────────────────────────────────
// TOKEN DE TÉLÉCHARGEMENT SÉCURISÉ
// ─────────────────────────────────────────────
model DownloadToken {
  id            String    @id @default(uuid())
  orderItemId   String                         @map("order_item_id")
  orderItem     OrderItem @relation(fields: [orderItemId], references: [id])
  token         String    @unique @default(uuid())
  downloadCount Int       @default(0)          @map("download_count")
  maxDownloads  Int       @default(3)          @map("max_downloads")
  expiresAt     DateTime                       @map("expires_at")
  isActive      Boolean   @default(true)       @map("is_active")
  createdAt     DateTime  @default(now())      @map("created_at")
  updatedAt     DateTime  @updatedAt           @map("updated_at")

  @@map("download_tokens")
}

// ─────────────────────────────────────────────
// AVIS CLIENT
// ─────────────────────────────────────────────
model Review {
  id         String   @id @default(uuid())
  productId  String                        @map("product_id")
  product    Product  @relation(fields: [productId], references: [id])
  buyerEmail String   @db.VarChar(150)     @map("buyer_email")
  rating     Int      // 1 à 5
  comment    String?  @db.Text
  isApproved Boolean  @default(false)      @map("is_approved")
  createdAt  DateTime @default(now())      @map("created_at")
  updatedAt  DateTime @updatedAt           @map("updated_at")

  @@map("reviews")
}

// ─────────────────────────────────────────────
// ADMINISTRATEUR
// ─────────────────────────────────────────────
model Admin {
  id           String    @id @default(uuid())
  email        String    @unique @db.VarChar(150)
  passwordHash String    @db.VarChar(255)          @map("password_hash")
  lastLogin    DateTime?                            @map("last_login")
  isActive     Boolean   @default(true)             @map("is_active")
  createdAt    DateTime  @default(now())            @map("created_at")
  updatedAt    DateTime  @updatedAt                 @map("updated_at")

  @@map("admins")
}

// ─────────────────────────────────────────────
// VUE DE PAGE (ANALYTICS)
// ─────────────────────────────────────────────
model PageView {
  id        String   @id @default(uuid())
  productId String?                       @map("product_id")
  product   Product? @relation(fields: [productId], references: [id])
  sessionId String?  @db.VarChar(100)     @map("session_id")
  utmSource String?  @db.VarChar(100)     @map("utm_source")
  utmMedium String?  @db.VarChar(100)     @map("utm_medium")
  ipHash    String?  @db.VarChar(64)      @map("ip_hash")
  userAgent String?  @db.Text             @map("user_agent")
  createdAt DateTime @default(now())      @map("created_at")

  @@map("page_views")
}
```

---

## Docker Compose complet (docker-compose.yml)

```yaml
version: '3.9'

networks:
  blackstore-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
  minio-data:
  files-storage:

services:

  # ── API NESTJS ──────────────────────────────────────────────────────
  nestjs-api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    container_name: blackstore-api
    ports:
      - "3000:3000"
    volumes:
      - ./apps/api:/app
      - /app/node_modules
      - files-storage:/app/storage
    environment:
      - NODE_ENV=development
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - blackstore-network
    restart: unless-stopped

  # ── STOREFRONT NEXT.JS ──────────────────────────────────────────────
  nextjs-storefront:
    build:
      context: ./apps/storefront
      dockerfile: Dockerfile
    container_name: blackstore-storefront
    ports:
      - "3001:3001"
    volumes:
      - ./apps/storefront:/app
      - /app/node_modules
      - /app/.next
    environment:
      - NODE_ENV=development
      - PORT=3001
    env_file:
      - .env
    depends_on:
      - nestjs-api
    networks:
      - blackstore-network
    restart: unless-stopped

  # ── ADMIN DASHBOARD REACT/VITE ──────────────────────────────────────
  react-admin:
    build:
      context: ./apps/admin
      dockerfile: Dockerfile
    container_name: blackstore-admin
    ports:
      - "3002:3002"
    volumes:
      - ./apps/admin:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    env_file:
      - .env
    depends_on:
      - nestjs-api
    networks:
      - blackstore-network
    restart: unless-stopped

  # ── POSTGRESQL 16 ────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: blackstore-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-blackstore}
      POSTGRES_USER: ${POSTGRES_USER:-blackstore}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-blackstore_dev_password}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-blackstore} -d ${POSTGRES_DB:-blackstore}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - blackstore-network
    restart: unless-stopped

  # ── REDIS 7 ──────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: blackstore-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - blackstore-network
    restart: unless-stopped

  # ── MINIO (S3-compatible) ─────────────────────────────────────────────
  minio:
    image: minio/minio
    container_name: blackstore-minio
    ports:
      - "9000:9000"  # API S3
      - "9001:9001"  # Console web — accès : http://localhost:9001
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-blackstore_minio}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-blackstore_minio_secret}
    volumes:
      - minio-data:/data
    command: server /data --console-address ":9001"
    networks:
      - blackstore-network
    restart: unless-stopped

  # ── MAILHOG (SMTP fictif) ─────────────────────────────────────────────
  mailhog:
    image: mailhog/mailhog
    container_name: blackstore-mailhog
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # UI web — accès : http://localhost:8025
    networks:
      - blackstore-network
    restart: unless-stopped
```

---

## Variables d'environnement (.env.example)

```env
# ── GÉNÉRAL ──────────────────────────────────────────────────────────
NODE_ENV=development
APP_PORT=3000

# ── BASE DE DONNÉES ───────────────────────────────────────────────────
POSTGRES_DB=blackstore
POSTGRES_USER=blackstore
POSTGRES_PASSWORD=blackstore_dev_password
DATABASE_URL="postgresql://blackstore:blackstore_dev_password@postgres:5432/blackstore?schema=public"

# ── REDIS ─────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── JWT ───────────────────────────────────────────────────────────────
JWT_SECRET=change_this_to_a_strong_random_secret_64_chars_minimum
JWT_REFRESH_SECRET=change_this_to_another_strong_random_secret_64_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ── CINETPAY ─────────────────────────────────────────────────────────
CINETPAY_API_KEY=your_cinetpay_api_key
CINETPAY_SITE_ID=your_cinetpay_site_id
CINETPAY_API_URL=https://api-checkout.cinetpay.com/v2
# URL publique qui recevra les notifications CinetPay (ngrok en dev)
CINETPAY_NOTIFY_URL=https://your-ngrok-url.ngrok.io/payments/notify
# URL de retour après paiement (affichée dans la popup CinetPay)
CINETPAY_RETURN_URL=http://localhost:3001/commande/succes
CINETPAY_CURRENCY=XAF

# ── MINIO (STOCKAGE FICHIERS) ─────────────────────────────────────────
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=blackstore_minio
MINIO_SECRET_KEY=blackstore_minio_secret
MINIO_BUCKET=blackstore

# ── EMAIL (MAILHOG EN DEV) ────────────────────────────────────────────
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM="BlackStore <noreply@blackstore.cm>"

# ── STOCKAGE FICHIERS LOCAL ───────────────────────────────────────────
# Ce dossier est HORS du dossier public — jamais accessible par URL directe
FILE_STORAGE_PATH=/app/storage/files
MAX_FILE_SIZE_MB=500

# ── SÉCURITÉ ─────────────────────────────────────────────────────────
BCRYPT_SALT_ROUNDS=12
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
ORDERS_RATE_LIMIT_MAX=5

# ── FRONTEND — STOREFRONT ─────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_CINETPAY_SITE_ID=your_cinetpay_site_id
# Pixels Marketing (optionnel en dev, requis en prod)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_META_PIXEL_ID=
NEXT_PUBLIC_TIKTOK_PIXEL_ID=
NEXT_PUBLIC_WHATSAPP_SUPPORT=+237XXXXXXXXX

# ── FRONTEND — ADMIN ──────────────────────────────────────────────────
VITE_API_URL=http://localhost:3000
```

---

## Modules NestJS à créer (squelettes complets)

Créer les modules suivants dans `apps/api/src/modules/` avec le pattern NestJS standard
(fichiers : `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/` folder) :

```
modules/
├── auth/
│   # POST /auth/login        — Connexion admin (email + password → JWT)
│   # POST /auth/refresh      — Renouveler access token via refresh token (httpOnly cookie)
│
├── products/
│   # GET    /products          — Liste paginée avec filtres (category, search, sort, featured)
│   # GET    /products/featured — Produits mis en avant
│   # GET    /products/:slug    — Détail produit
│   # GET    /products/search   — Recherche full-text
│   # POST   /products          — Créer produit [Admin JWT]
│   # PATCH  /products/:id      — Modifier produit [Admin JWT]
│   # DELETE /products/:id      — Supprimer produit [Admin JWT]
│   # POST   /products/:id/upload-file        — Upload APK/EXE/ZIP [Admin JWT]
│   # POST   /products/:id/upload-screenshots — Upload images [Admin JWT]
│
├── categories/
│   # GET    /categories         — Liste catégories actives (public)
│   # POST   /categories         — Créer [Admin JWT]
│   # PATCH  /categories/:id     — Modifier [Admin JWT]
│   # DELETE /categories/:id     — Supprimer [Admin JWT]
│
├── orders/
│   # POST  /orders              — Créer une commande (public)
│   # GET   /orders              — Liste commandes [Admin JWT]
│   # GET   /orders/:id          — Détail commande [Admin JWT]
│   # PATCH /orders/:id/refund   — Marquer remboursé [Admin JWT]
│   # POST  /orders/:id/resend-download — Renvoyer email [Admin JWT]
│
├── payments/
│   # POST     /payments/initiate — Initialiser paiement CinetPay (retourne paymentToken)
│   # GET|POST /payments/notify   — Notification CinetPay (notify_url)
│   #   → GET  : retourner HTTP 200 immédiatement (ping CinetPay)
│   #   → POST : appeler POST /v2/payment/check pour vérifier le statut
│   #          → ACCEPTED          : valider Order, générer DownloadTokens, email async
│   #          → REFUSED           : marquer Order failed
│   #          → WAITING_FOR_CUSTOMER : ne rien faire (ne pas marquer failed)
│   #   Idempotence : vérifier que paymentReference n'est pas déjà traité
│
├── downloads/
│   # GET /downloads/:token — Streaming sécurisé du fichier
│   #   → Vérifier token (existant, actif, non expiré, quota non atteint)
│   #   → Incrémenter downloadCount
│   #   → Logger IP hashée, user-agent, timestamp
│   #   → Streamer le fichier directement (jamais de redirect)
│   #   → HTTP 410 si token expiré, HTTP 403 si quota atteint
│
├── reviews/
│   # GET  /reviews/:productId  — Avis approuvés (public)
│   # POST /reviews/:productId  — Soumettre un avis (vérifier email acheteur)
│   # GET  /reviews             — Tous les avis [Admin JWT]
│   # PATCH /reviews/:id/approve — Approuver/refuser [Admin JWT]
│   # DELETE /reviews/:id        — Supprimer [Admin JWT]
│
├── analytics/
│   # POST /analytics/pageview  — Tracker une vue produit (UTM + session)
│
└── dashboard/
    # GET /dashboard/stats        — KPIs: revenus, commandes, taux conversion
    # GET /dashboard/analytics    — Sources trafic, top produits
    # GET /dashboard/sales-chart  — Courbe des ventes (params: period, groupBy)
```

### Configuration critique du module Payments (CinetPay)

Le module `payments` doit implémenter ce flux exact :

```typescript
// ÉTAPE 1 — Initiation (appelée par le Storefront au checkout)
// POST /payments/initiate
// Body: { orderId: string }
// → Appelle POST https://api-checkout.cinetpay.com/v2/payment
// → Payload CinetPay: { apikey, site_id, transaction_id (= orderNumber),
//     amount, currency: "XAF", notify_url, return_url,
//     customer_name, customer_email, customer_phone_number,
//     description: "BlackStore - Commande BS-2026-XXXXX", channels: "ALL" }
// → Retourne: { paymentToken, paymentUrl } au Storefront

// ÉTAPE 2 — Notification (appelée par CinetPay après paiement)
// GET /payments/notify  → return HTTP 200 "" (ping de disponibilité)
// POST /payments/notify
// → Extraire cid (transaction_id) du body
// → Vérifier idempotence : chercher Order par paymentReference = cid
//    Si Order.status === 'paid' → retourner HTTP 200 (déjà traité)
// → Appeler POST https://api-checkout.cinetpay.com/v2/payment/check
//    Payload: { apikey, site_id, transaction_id: cid }
// → Analyser la réponse :
//    data.status === 'ACCEPTED'              → valider la commande
//    data.status === 'REFUSED'               → marquer Order failed
//    data.status === 'WAITING_FOR_CUSTOMER'  → ne rien faire, retourner 200
// → Si ACCEPTED :
//    - Mettre à jour Order: status='paid', paidAt=now(), paymentMethod
//    - Créer DownloadToken pour chaque OrderItem
//    - Envoyer email via BullMQ (async, non-bloquant)
// → Toujours retourner HTTP 200 à CinetPay (même en cas d'erreur interne)
```

---

## Configuration NestJS principale

### apps/api/src/main.ts

```typescript
// Configurer dans cet ordre :
// 1. app.use(helmet())
// 2. app.enableCors({ origin: [STOREFRONT_URL, ADMIN_URL], credentials: true })
// 3. app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
// 4. app.use(cookieParser())
// 5. Si NODE_ENV !== 'production' : configurer Swagger sur /docs
// 6. app.listen(process.env.APP_PORT || 3000)
```

### apps/api/src/app.module.ts

```typescript
// Importer et configurer :
// - ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })
// - PrismaModule (global: true)
// - ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])
// - BullModule.forRootAsync({ useFactory: ... Redis connection })
// - AuthModule, ProductsModule, CategoriesModule, OrdersModule,
//   PaymentsModule, DownloadsModule, ReviewsModule, AnalyticsModule, DashboardModule
```

---

## Seed de données (apps/api/prisma/seed.ts)

Créer un seed qui génère :

**1 Admin par défaut :**
```
email: admin@blackstore.cm
password: Admin@BlackStore2026!
(hashé avec bcrypt salt 12)
```

**3 Catégories :**
- Applications Android (slug: applications-android, icône: 📱)
- Logiciels Desktop (slug: logiciels-desktop, icône: 💻)
- Outils Bureautique (slug: outils-bureautique, icône: 📊)

**2 Produits de démonstration** (avec toutes les métadonnées renseignées, `is_active: false`,
liés aux catégories créées, prix en FCFA, tags, version, changelog JSON) :
- "App Demo Android v1.0" — platform: android, price: 5000
- "Logiciel Demo Desktop v2.1" — platform: desktop, price: 15000

---

## Dockerfiles

### apps/api/Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/main.ts"]
```

### apps/storefront/Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev", "--", "--port", "3001", "--hostname", "0.0.0.0"]
```

### apps/admin/Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3002
CMD ["npm", "run", "dev", "--", "--port", "3002", "--host", "0.0.0.0"]
```

---

## README.md à générer

Le README doit inclure :

```markdown
# BlackStore — Plateforme de Vente de Produits Numériques

## Démarrage rapide

### Prérequis
- Docker Desktop installé
- Git

### Installation
git clone <repo>
cd blackstore
cp .env.example .env
# Éditer .env avec vos vraies valeurs CinetPay

### Démarrer tout l'environnement
docker compose up --build

### Accès aux services
| Service          | URL                        |
|------------------|----------------------------|
| Storefront       | http://localhost:3001      |
| Admin Dashboard  | http://localhost:3002      |
| API NestJS       | http://localhost:3000      |
| API Swagger      | http://localhost:3000/docs |
| PostgreSQL       | localhost:5432             |
| Redis            | localhost:6379             |
| MinIO Console    | http://localhost:9001      |
| MailHog          | http://localhost:8025      |

### Initialiser la base de données (première fois)
docker compose exec nestjs-api npx prisma migrate dev --name init
docker compose exec nestjs-api npx prisma db seed

### Connexion admin par défaut
Email    : admin@blackstore.cm
Password : Admin@BlackStore2026!
```

---

## Format de sortie attendu — ordre de génération

Génère les fichiers dans cet ordre strict :

1. `package.json` racine (npm workspaces)
2. `.gitignore`
3. `docker-compose.yml`
4. `docker-compose.prod.yml` (squelette vide avec commentaires)
5. `.env.example`
6. `apps/api/prisma/schema.prisma`
7. `apps/api/prisma/seed.ts`
8. `apps/api/package.json`
9. `apps/api/tsconfig.json`
10. `apps/api/src/main.ts`
11. `apps/api/src/app.module.ts`
12. `apps/api/src/prisma/prisma.module.ts` + `prisma.service.ts`
13. Tous les modules NestJS (un par un, complets)
14. `apps/storefront/package.json` + `tsconfig.json` + `tailwind.config.ts`
15. `apps/storefront/src/app/layout.tsx` + `page.tsx` (squelettes)
16. `apps/admin/package.json` + `tsconfig.json` + `vite.config.ts` + `tailwind.config.ts`
17. `apps/admin/src/App.tsx` + `main.tsx` (squelettes)
18. `apps/api/Dockerfile` + `apps/storefront/Dockerfile` + `apps/admin/Dockerfile`
19. `packages/shared/src/index.ts` (types communs)
20. `README.md`

---

## Critères de qualité non-négociables

- TypeScript `strict: true` dans tous les `tsconfig.json`
- Zéro `any` implicite
- Toutes les variables d'environnement validées au démarrage (Joi ou zod)
- Chaque module NestJS dans son propre dossier avec `index.ts` barrel export
- Conventions : camelCase variables, PascalCase classes, kebab-case fichiers
- Commentaires JSDoc sur toutes les méthodes de service
- Le fichier `schema.prisma` est la source de vérité — aucune entité ne doit être oubliée
- Les fichiers ne sont **jamais** accessibles via URL directe (stockés hors du dossier public)

---

## Checklist de validation post-génération

Après génération, vérifie que :

- [ ] `docker compose up --build` démarre sans erreur
- [ ] `http://localhost:3000/docs` affiche le Swagger
- [ ] `http://localhost:8025` affiche l'interface MailHog
- [ ] `http://localhost:9001` affiche la console MinIO
- [ ] `prisma migrate dev` s'exécute sans erreur
- [ ] `prisma db seed` crée l'admin, les catégories et les produits de démo
- [ ] `POST /auth/login` avec les credentials admin retourne un JWT valide
- [ ] `GET /products` retourne une liste vide sans erreur
- [ ] `GET /payments/notify` retourne HTTP 200 (ping CinetPay)
- [ ] Le dossier `storage/files` n'est pas dans le dossier public
- [ ] Aucun secret n'est commité (`.env` dans `.gitignore`)
