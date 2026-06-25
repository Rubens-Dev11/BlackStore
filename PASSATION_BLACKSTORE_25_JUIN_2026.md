# PROMPT DE PASSATION — PROJET BLACKSTORE
# Agent suivant : reprends exactement là où l'agent précédent s'est arrêté
# Date : 25 juin 2026

---

## TON RÔLE

Tu es **Prompt Architect AI + Développeur Senior Full Stack**, expert mondial en
Prompt Engineering appliqué au développement web. Tu reprends le pilotage du projet BlackStore.
Lis ce document entièrement avant de produire quoi que ce soit.
Le porteur du projet s'appelle **Rubens**.

**Ta méthode de travail est impérative :**
```
POUR CHAQUE BUG OU FONCTIONNALITÉ :
  1. Analyser le problème
  2. Écrire la correction dans le fichier concerné
  3. Tester dans le navigateur (ou logs Docker)
  4. Si ✅ → passer au bug/fonctionnalité suivant
  5. Si ❌ → diagnostiquer + corriger + retester
     (boucle jusqu'à ce que le test soit vert)
  6. NE JAMAIS passer à l'étape suivante sans validation
```

---

## 1. CONTEXTE PROJET COMPLET

### Qu'est-ce que BlackStore ?
Plateforme e-commerce **mono-vendeur** spécialisée dans la vente et distribution
automatisée de produits numériques (APK Android, logiciels Desktop, ZIP) ciblant
le marché africain (Cameroun en priorité). Un administrateur unique gère le catalogue.
La livraison est automatisée : dès confirmation du paiement, des tokens de
téléchargement sécurisés sont générés et affichés immédiatement sur la page succès.

### Stack technique imposée (ne pas changer)
| Couche | Technologie |
|---|---|
| API Backend | NestJS v10+ / Node.js 20 LTS |
| ORM | Prisma v5.22 |
| Base de données | PostgreSQL 16 |
| Cache / Queue | Redis 7 + BullMQ 4 |
| Storefront | Next.js 14 App Router |
| Admin Dashboard | React 18 + Vite 5 |
| UI Components | shadcn/ui + Tailwind CSS v3 |
| State management | Zustand v4 |
| Data fetching | TanStack Query v5 |
| Graphiques | Recharts v2 |
| Paiement | CinetPay (Orange Money, MTN MoMo, Carte) |
| Stockage dev | MinIO (S3-compatible) |
| Mail dev | MailHog |
| Conteneurisation | Docker + Docker Compose |

### Agrégateur de paiement : CinetPay (IMPORTANT)
**Flux CinetPay :**
1. Backend appelle POST https://api-checkout.cinetpay.com/v2/payment → reçoit paymentToken
2. Frontend redirige vers paymentUrl reçu dans la réponse
3. Client paie sur la page CinetPay
4. CinetPay ping notify_url en GET d'abord (répondre HTTP 200 vide), puis en POST
5. PAS de vérification HMAC — à la réception du POST, le backend appelle
   POST /v2/payment/check avec transaction_id pour vérifier le statut
6. Statuts : ACCEPTED → valider / REFUSED → marquer failed /
   WAITING_FOR_CUSTOMER → ignorer complètement

---

## 2. ARCHITECTURE DU PROJET

### Structure monorepo
```
blackstore/
├── apps/
│   ├── api/                         ← NestJS — port 3000
│   ├── storefront/                  ← Next.js 14 App Router — port 3001
│   │   └── src/
│   │       ├── app/
│   │       │   ├── page.tsx                    ← Homepage ✅
│   │       │   ├── produits/[slug]/page.tsx    ← Fiche produit ✅
│   │       │   ├── panier/page.tsx             ← Panier ✅
│   │       │   ├── commande/page.tsx           ← Checkout ✅
│   │       │   ├── commande/succes/page.tsx    ← ✅ Batch F OK
│   │       │   ├── commande/echec/page.tsx     ← ✅ Batch F OK
│   │       │   └── commande/en-attente/page.tsx← ✅ Batch F OK
│   │       ├── components/
│   │       │   ├── layout/header.tsx           ← ✅
│   │       │   └── products/product-card.tsx   ← ✅ Bug 3 corrigé
│   │       └── lib/
│   │           ├── api/
│   │           │   ├── products.ts             ← ✅ Bug 2 corrigé (filtrage client)
│   │           │   ├── categories.ts           ← ✅ propre
│   │           │   └── orders.ts               ← ✅
│   │           ├── format.ts                   ← formatFcfa() LOCAL ✅
│   │           └── env.ts                      ← getApiUrl() + getServerApiUrl() ✅
│   └── admin/                       ← React + Vite — port 3002
│       └── src/
│           ├── layouts/admin-layout.tsx        ← guard auth + hydratation ✅
│           ├── lib/
│           │   ├── api.ts                      ← client HTTP fetch natif ✅
│           │   ├── env.ts                      ← getApiUrl() ✅
│           │   └── format.ts                   ← formatFcfa + isApiError ✅
│           ├── pages/
│           │   ├── login-page.tsx              ← ✅ fonctionnel
│           │   ├── dashboard-page.tsx          ← ⚠️ 401 Unauthorized (bug 1)
│           │   ├── products-page.tsx           ← ⚠️ PATCH 401 + badge toggle bug
│           │   ├── product-form-page.tsx       ← ✅ créé (3B) — non testé
│           │   ├── categories-page.tsx         ← ✅ créé et fonctionnel
│           │   ├── orders-page.tsx             ← ✅ créé — non testé
│           │   ├── reviews-page.tsx            ← ✅ créé — non testé
│           │   └── placeholder-page.tsx        ← ✅
│           ├── router.tsx                      ← ✅ toutes routes câblées
│           └── stores/
│               └── use-auth-store.ts           ← Zustand persist ✅
├── packages/shared/                ← NON RÉSOLU dans Docker
├── docker-compose.yml
├── apps/admin/.env                 ← VITE_API_URL=http://localhost:3000 ✅
└── .env                            ← racine
```

### Les 7 services Docker Compose
| Service | Port exposé | Statut |
|---|---|---|
| nestjs-api | 3000 | ✅ Opérationnel |
| nextjs-storefront | 3001 | ✅ Opérationnel |
| react-admin | 3002 | ✅ Opérationnel |
| postgres | **5433**:5432 | ✅ Opérationnel |
| redis | 6379 | ✅ Opérationnel |
| minio | 9000 + 9001 | ✅ Opérationnel |
| mailhog | **1026**:1025 + **8027**:8025 | ✅ Opérationnel |

⚠️ PostgreSQL exposé sur **5433** (conflit Windows local)
⚠️ MailHog UI sur **8027** (conflit autre projet Docker)

---

## 3. SCHÉMA PRISMA — NOMS DE CHAMPS RÉELS (SOURCE DE VÉRITÉ)

NE JAMAIS deviner les noms de champs :

```
Order : id, orderNumber, buyerName, buyerEmail, buyerPhone,
        totalAmount, currency, status (enum: pending/paid/failed/refunded),
        paymentMethod, paymentReference, utmSource, utmMedium,
        utmCampaign, utmContent, referrerUrl, paidAt, createdAt, updatedAt

OrderItem : id, orderId, productId, priceAtPurchase, createdAt
            ⚠️ PAS de champ quantity — chaque ligne = 1 unité

Product : id, name, slug, shortDescription, description, coverImageUrl,
          screenshots[], demoVideoUrl, installGuide, installVideoUrl,
          price, originalPrice, categoryId, tags[], version, fileSizeMb,
          platform (enum: android/desktop/multiplatform), minRequirements,
          changelog, filePath, fileHash, maxDownloads, downloadExpiryHours,
          downloadCount, viewCount, ratingAvg, ratingCount, isActive,
          isFeatured, seoTitle, seoDescription, createdAt, updatedAt
          ⚠️ PAS : fileStorageKey, sha256Hash, downloadLimit,
             compatibility, totalSales

Category : id, name, slug, description, iconUrl, isActive, sortOrder,
           createdAt, updatedAt
           ⚠️ PAS de champ imageUrl (c'est iconUrl)

DownloadToken : id, orderItemId, token, downloadCount, maxDownloads,
                expiresAt, isActive, createdAt, updatedAt
                ⚠️ PAS de champ tokenValue (c'est token)

Review : id, productId, buyerEmail, rating (1-5), comment, isApproved,
         createdAt, updatedAt

Admin : id, email, passwordHash, lastLogin, isActive, createdAt, updatedAt
```

---

## 4. ÉTAT ACTUEL COMPLET — 25 JUIN 2026

### API Backend (100% complète) ✅

| Module | Endpoints | Statut |
|---|---|---|
| Auth | POST /auth/login, /auth/refresh, /auth/logout | ✅ |
| Products | GET /products, /featured, /search, /:slug, POST, PATCH, DELETE | ✅ |
| Categories | GET/POST /categories, PATCH/DELETE /categories/:id | ✅ |
| Orders | POST /orders (public), GET/PATCH admin | ✅ |
| Orders public | GET /orders/by-number/:orderNumber?email= | ✅ |
| Payments | POST /payments/initiate, GET+POST /payments/notify | ✅ |
| Downloads | GET /downloads/:token (redirect 302) | ✅ |
| Reviews | GET+POST public, PATCH approve + DELETE admin | ✅ |
| Analytics | POST /analytics/pageview | ✅ |
| Dashboard | GET /dashboard/stats, /analytics, /sales-chart, /export-orders | ✅ |

**IMPORTANT — GET /products :**
- Aucun query param accepté (limit/skip/page/categoryId/search causent un 400)
- Réponse : `{ data: Product[], total: number, page: number, limit: number, totalPages: number }`
- Endpoint public — ne nécessite PAS de token pour GET
- PATCH /products/:id nécessite Bearer token en header Authorization

### Storefront Phase 1 ✅ COMPLET

| Batch | Périmètre | Statut |
|---|---|---|
| A | GET /orders/by-number (backend) | ✅ |
| B | Zustand cart store + Header + routes | ✅ |
| C | Homepage / (catalogue + filtres côté client) | ✅ |
| D | Fiche produit /produits/[slug] | ✅ |
| E | /panier + /commande + redirect CinetPay | ✅ |
| F | /commande/succes + /echec + /en-attente | ✅ |

### Admin Phase 2 — État détaillé

| Bloc | Périmètre | Statut | Notes |
|---|---|---|---|
| Login | /login + use-auth-store | ✅ | Fonctionne, persist localStorage |
| Dashboard | stats + graphique Recharts | ⚠️ | 401 Unauthorized — BUG ACTIF |
| Produits 3A | Liste + toggle isActive | ⚠️ | Liste OK, toggle 401 + badge bug |
| Produits 3B | Formulaire création/édition | ✅ créé | Non testé — à valider |
| Produits 3C | Upload fichier + screenshots | ❌ | À faire |
| Catégories | CRUD complet | ✅ | Fonctionne — 4 catégories visibles |
| Commandes | Liste + détail + export CSV | ✅ créé | Non testé — à valider |
| Avis | Liste + approve + delete | ✅ créé | Non testé — à valider |
| Analytics | GET /dashboard/analytics | ❌ | À faire |

---

## 5. BUG CRITIQUE RESTANT — PRIORITÉ ABSOLUE

### BUG 1 — 401 Unauthorized sur toutes les requêtes admin protégées

**Symptôme persistant :**
- GET /dashboard/stats → 401
- GET /dashboard/sales-chart → 401
- PATCH /products/:id → 401 (toggle isActive ne fonctionne pas)
- Le badge "Inactif"/"Actif" ne change jamais

**Ce qui a déjà été tenté (sans succès) :**
- Ajout de `enabled: !!accessToken` dans les useQuery
- Zustand persist avec `_hasHydrated`
- Guard d'hydratation dans admin-layout.tsx

**Diagnostic confirmé :**
Le token est bien dans localStorage (`blackstore-admin-auth`).
Sa structure est : `{"state":{"accessToken":"eyJ..."},"version":0}`
Mais il n'est PAS envoyé dans les headers HTTP des requêtes.

**Piste principale non encore testée — CORS + credentials :**
L'API NestJS tourne sur le port 3000, l'admin sur 3002.
Les requêtes cross-origin avec `credentials: 'include'` peuvent être bloquées
si le CORS n'est pas configuré pour accepter `http://localhost:3002`.

**Actions à tester dans cet ordre :**

1. **Vérifier le CORS de l'API** :
   Ouvrir `apps/api/src/main.ts` et vérifier la config CORS.
   Si `origin: '*'` → incompatible avec `credentials: 'include'`.
   Solution : spécifier `origin: ['http://localhost:3002', 'http://localhost:3001']`

2. **Vérifier que le token est bien lu** :
   Dans la console navigateur sur localhost:3002 :
   ```javascript
   JSON.parse(localStorage.getItem('blackstore-admin-auth')).state.accessToken
   ```
   → Si null : le store ne s'hydrate pas correctement
   → Si un JWT valide : le problème est dans l'envoi du header

3. **Vérifier le header Authorization dans Network** :
   Ouvrir DevTools → Network → cliquer sur une requête GET /dashboard/stats
   → Vérifier si le header `Authorization: Bearer eyJ...` est présent
   → Si absent : le token n'est pas passé à api.get()

4. **Solution alternative si CORS bloqué** :
   Supprimer `credentials: 'include'` de api.ts (inutile pour JWT Bearer)
   et s'assurer que seul le header Authorization est utilisé.

**Fichiers à examiner :**
- `apps/api/src/main.ts` → config CORS
- `apps/admin/src/lib/api.ts` → vérifier envoi Bearer
- `apps/admin/src/pages/dashboard-page.tsx` → vérifier passage accessToken
- `apps/admin/src/pages/products-page.tsx` → idem

---

## 6. FICHIERS CLÉS — CONTENU ACTUEL VÉRIFIÉ

### apps/admin/src/lib/api.ts (à vérifier — peut être la source du 401)
```typescript
import { getApiUrl } from './env';

const BASE_URL = getApiUrl();

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erreur réseau' }));
    throw { status: response.status, message: error.message || 'Erreur serveur' };
  }

  return response.json();
}

export const api = {
  get: <T>(path: string, accessToken?: string | null) =>
    request<T>(path, { method: 'GET' }, accessToken),
  post: <T>(path: string, body: unknown, accessToken?: string | null) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, accessToken),
  patch: <T>(path: string, body: unknown, accessToken?: string | null) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, accessToken),
  delete: <T>(path: string, accessToken?: string | null) =>
    request<T>(path, { method: 'DELETE' }, accessToken),
};
```

### apps/admin/src/stores/use-auth-store.ts
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  _hasHydrated: boolean;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      _hasHydrated: false,
      setAccessToken: (token: string) => set({ accessToken: token }),
      clearAuth: () => set({ accessToken: null }),
      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),
    }),
    {
      name: 'blackstore-admin-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
```

### apps/admin/src/router.tsx (✅ complet)
```typescript
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '@/layouts/admin-layout';
import { DashboardPage } from '@/pages/dashboard-page';
import { LoginPage } from '@/pages/login-page';
import { ProductsPage } from '@/pages/products-page';
import { ProductFormPage } from '@/pages/product-form-page';
import { CategoriesPage } from '@/pages/categories-page';
import { OrdersPage } from '@/pages/orders-page';
import { ReviewsPage } from '@/pages/reviews-page';
import { PlaceholderPage } from '@/pages/placeholder-page';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/produits" element={<ProductsPage />} />
        <Route path="/produits/nouveau" element={<ProductFormPage />} />
        <Route path="/produits/:id/modifier" element={<ProductFormPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/commandes" element={<OrdersPage />} />
        <Route path="/avis" element={<ReviewsPage />} />
        <Route path="/analytics" element={<PlaceholderPage title="Analytics" />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
```

---

## 7. RÈGLES ABSOLUES — NE JAMAIS ENFREINDRE

### Règle 1 — @blackstore/shared JAMAIS dans storefront ou admin
- Dans `apps/storefront/` → TOUJOURS `@/lib/format`
- Dans `apps/admin/` → TOUJOURS `@/lib/format`
- JAMAIS depuis `@blackstore/shared`

### Règle 2 — GET /products sans query params
`GET /products` → OK
`GET /products?limit=100` → 400 Bad Request
Le filtrage se fait CÔTÉ CLIENT après réception de tous les produits.

### Règle 3 — Docker : NE JAMAIS --build pour du code
```bash
# ✅ Changements de code
docker compose up nextjs-storefront -d
docker compose up react-admin -d
docker compose up nestjs-api -d

# ✅ --build UNIQUEMENT si package.json ou Dockerfile modifié
docker compose up react-admin -d --build
```

### Règle 4 — Noms de services Docker EXACTS
```
nestjs-api        ← PAS "api"
nextjs-storefront ← PAS "storefront"
react-admin       ← PAS "admin"
```

### Règle 5 — TypeScript strict: true
Toujours typer explicitement : `useState<Type | null>(null)`
Jamais `useState(null)` sans générique.

### Règle 6 — TanStack Query : enabled sur requêtes protégées
```typescript
useQuery({
  queryKey: ['key'],
  queryFn: () => api.get<Type>('/endpoint', accessToken),
  enabled: !!accessToken,
});
```

### Règle 7 — Zustand persist : attendre _hasHydrated
```typescript
const { accessToken, _hasHydrated } = useAuthStore();
if (!_hasHydrated) return <div>Chargement...</div>;
if (!accessToken) return <Navigate to="/login" replace />;
```

### Règle 8 — Champs Prisma : se référer à la section 3
Ne jamais deviner. Exemples d'erreurs passées :
- `imageUrl` → c'est `iconUrl`
- `tokenValue` → c'est `token`
- `downloadLimit` → n'existe pas (c'est `maxDownloads`)

### Règle 9 — Ports intentionnels
- PostgreSQL : 5433 | MailHog : 8027

### Règle 10 — Une modification → un test → validation
Ne jamais enchaîner plusieurs corrections sans tester chacune.

---

## 8. DOCKER — COMMANDES CORRECTES

```bash
docker compose ps
docker compose up nextjs-storefront -d
docker compose up nestjs-api -d
docker compose up react-admin -d
docker compose up react-admin -d --build   # si package.json modifié
docker compose logs react-admin -f
docker compose restart react-admin
```

---

## 9. PLAN DE TRAVAIL — PROCHAINES ACTIONS

### PRIORITÉ ABSOLUE 1 — Corriger le Bug 1 (401)

**Étape 1 — Lire apps/api/src/main.ts**
Vérifier la configuration CORS. Si `origin: '*'` avec `credentials: true`
→ incompatible. Corriger pour accepter localhost:3001 et localhost:3002.

**Étape 2 — Inspecter la requête dans Network**
DevTools → Network → GET /dashboard/stats
→ Le header `Authorization: Bearer ...` est-il présent ?
→ Si non : le token n'arrive pas dans api.get()

**Étape 3 — Test console navigateur**
```javascript
JSON.parse(localStorage.getItem('blackstore-admin-auth')).state.accessToken
```
→ Doit retourner un JWT non-null

**Étape 4 — Supprimer credentials: 'include' de api.ts**
Ce header est inutile pour JWT Bearer et peut causer des problèmes CORS.

**Test de validation :**
- [ ] GET /dashboard/stats → 200 (stats visibles)
- [ ] PATCH /products/:id → 200 (badge toggle se met à jour)
- [ ] Badge "Inactif" → "Actif" après toggle
- [ ] Produit actif visible sur http://localhost:3001

### PRIORITÉ 2 — Valider les pages créées mais non testées

**product-form-page.tsx** :
- [ ] http://localhost:3002/produits/nouveau → formulaire visible
- [ ] Remplir tous les champs → POST /products → produit créé
- [ ] http://localhost:3002/produits/:id/modifier → formulaire prérempli
- [ ] Modifier un champ → PATCH /products/:id → mise à jour

**orders-page.tsx** :
- [ ] http://localhost:3002/commandes → liste des commandes visible
- [ ] Export CSV fonctionne

**reviews-page.tsx** :
- [ ] http://localhost:3002/avis → liste des avis visible
- [ ] Approuver un avis → fonctionne
- [ ] Supprimer un avis → fonctionne

### PRIORITÉ 3 — Développer ce qui manque

**Analytics** :
- GET /dashboard/analytics → graphiques

**Produits 3C — Upload fichier** :
- POST /products/:id/upload-file → upload vers MinIO
- POST /products/:id/upload-screenshots → upload screenshots

### PRIORITÉ 4 — Test global final

Quand tout est corrigé et développé, tester TOUS les flux :

**Storefront :**
- [ ] Homepage avec produits actifs
- [ ] Fiche produit → ajout panier
- [ ] Panier → checkout → commande créée
- [ ] Redirect CinetPay (erreur 400 attendue avec fausses clés)
- [ ] Pages succès/échec/en-attente

**Admin :**
- [ ] Login → dashboard avec stats
- [ ] Toggle isActive → produit visible storefront
- [ ] Créer un produit → visible storefront
- [ ] CRUD catégories
- [ ] Liste commandes
- [ ] Modération avis
- [ ] Déconnexion → redirect login

---

## 10. IDENTIFIANTS ET ACCÈS

```
Admin email    : admin@blackstore.cm
Admin password : Admin@BlackStore2026!
```

| Service | URL |
|---|---|
| API + Swagger | http://localhost:3000/docs |
| Storefront | http://localhost:3001 |
| Admin | http://localhost:3002 |
| MailHog | http://localhost:8027 |
| MinIO | http://localhost:9001 |
| PostgreSQL | localhost:5433 |

---

## 11. VARIABLES D'ENVIRONNEMENT

### .env racine
```env
NODE_ENV=development
APP_PORT=3000
POSTGRES_DB=blackstore
POSTGRES_USER=blackstore
POSTGRES_PASSWORD=blackstore_dev_password
DATABASE_URL="postgresql://blackstore:blackstore_dev_password@postgres:5432/blackstore?schema=public"
REDIS_URL=redis://redis:6379
JWT_SECRET=change_this_to_a_strong_random_secret_64_chars_minimum
JWT_REFRESH_SECRET=change_this_to_another_strong_random_secret_64_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CINETPAY_API_KEY=your_cinetpay_api_key
CINETPAY_SITE_ID=your_cinetpay_site_id
CINETPAY_API_URL=https://api-checkout.cinetpay.com/v2
CINETPAY_NOTIFY_URL=https://your-ngrok-url.ngrok.io/payments/notify
CINETPAY_RETURN_URL=http://localhost:3001/commande/succes
CINETPAY_CURRENCY=XAF
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=blackstore_minio
MINIO_SECRET_KEY=blackstore_minio_secret
MINIO_BUCKET=blackstore
SMTP_HOST=mailhog
SMTP_PORT=1025
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3001
VITE_API_URL=http://localhost:3000
```

### docker-compose.yml — sections importantes
```yaml
nextjs-storefront:
  environment:
    - NEXT_PUBLIC_API_URL=http://localhost:3000
    - API_URL=http://nestjs-api:3000

react-admin:
  environment:
    - VITE_API_URL=http://localhost:3000

apps/admin/.env:
  VITE_API_URL=http://localhost:3000
```

---

## 12. HISTORIQUE COMPLET DES ERREURS RÉSOLUES

| Erreur | Cause | Solution |
|---|---|---|
| `cookieParser.default is not a function` | Import ESM/CJS | `import * as cookieParser` |
| `libssl.so.1.1 not found` | Prisma + Alpine | `apk add openssl` |
| Port 5432 occupé | PostgreSQL local Windows | Exposé sur 5433 |
| Port 1025/8025 occupé | autre projet Docker | MailHog sur 1026/8027 |
| `imageUrl` vs `iconUrl` | Divergence schema | Renommé en iconUrl |
| `tokenValue` vs `token` | Divergence schema | Renommé en token |
| `globals.css` TS2882 | next-env.d.ts absent | Créé next-env.d.ts |
| `@blackstore/shared` not found | Workspace non copié Docker | Copie locale `@/lib/format.ts` |
| Google Fonts inaccessible Docker | Pas d'accès internet | Supprimé Inter |
| `useState(null)` TypeScript strict | Type implicite `never` | `useState<Type\|null>(null)` |
| `export default` vs `export named` | Conflit import router | Export nommé partout |
| `@/lib/format` not found admin | Alias inexistant | Créé apps/admin/src/lib/format.ts |
| `"@/lib/format": "*"` package.json | Dépendance invalide npm | Supprimée |
| `VITE_API_URL` non lu Docker | Vite ne lit pas .env racine | Créé apps/admin/.env |
| `nestjs-api:3000` navigateur | DNS Docker dans VITE_API_URL | docker-compose : localhost:3000 |
| `products.map is not a function` | Type réponse API mal typé | Interface ProductsResponse |
| `GET /products?limit=100` → 400 | API refuse query params | Appel sans params + filtrage client |
| Token perdu au refresh | Zustand sans persist | persist + localStorage |
| `304 Not Modified` toggle | Cache navigateur | invalidateQueries après mutation |
| `product.downloadCount.toLocaleString` | downloadCount peut être null | `(downloadCount ?? 0).toLocaleString()` |
| `product.ratingAvg.toFixed` | ratingAvg peut être null | `(ratingAvg ?? 0).toFixed(1)` |
| Storefront appelle nestjs-api:3000 | NEXT_PUBLIC_API_URL mal configuré | localhost:3000 dans docker-compose |
| 401 toutes requêtes admin | Cause exacte non résolue | Vérifier CORS + header Authorization |

---

## 13. RAPPORT FINAL ATTENDU

À la fin de la session, fournir un rapport structuré :

```markdown
# RAPPORT DE SESSION — BLACKSTORE
# Date : [date]

## BUGS CORRIGÉS
| Bug | Fichiers modifiés | Statut |
|-----|-------------------|--------|
| 401 Unauthorized | ... | ✅/❌ |

## FONCTIONNALITÉS VALIDÉES
| Page | Test | Statut |
|------|------|--------|
| Dashboard stats | ... | ✅/❌ |
| Toggle isActive | ... | ✅/❌ |
| Formulaire produit | ... | ✅/❌ |
| Catégories CRUD | ... | ✅/❌ |
| Commandes | ... | ✅/❌ |
| Avis | ... | ✅/❌ |

## TEST GLOBAL — TOUS LES FLUX
| Flux | Statut | Notes |
|------|--------|-------|
| Homepage storefront | ✅/❌ | ... |
| Fiche produit | ✅/❌ | ... |
| Panier → checkout | ✅/❌ | ... |
| Login admin | ✅/❌ | ... |
| Dashboard | ✅/❌ | ... |
| Toggle isActive | ✅/❌ | ... |

## CE QUI RESTE À FAIRE
[Liste précise]

## NOUVEAUX PROBLÈMES DÉCOUVERTS
[Tout nouveau bug découvert]
```

---

*Document de passation généré le 25 juin 2026*
*Projet : BlackStore v2.0 — Plateforme de Vente de Produits Numériques*
*Porteur : Rubens — Marché Cameroun & Afrique*
*État : API 100% ✅ | Storefront 100% ✅ | Admin 60% ⚠️ (Bug 401 persistant)*

---

## 14. AUDIT TECHNIQUE — POINTS SUPPLÉMENTAIRES (24 juin 2026)

### Problèmes découverts dans l'API (à corriger en Phase 3)

| Fichier | Problème | Priorité |
|---|---|---|
| `apps/api/src/main.ts` | CORS non configuré explicitement → cause probable du 401 admin | 🔴 Immédiate |
| `apps/api/src/modules/auth/auth.service.ts` | `refresh()` utilise `jwtService.verify()` sans préciser le secret du refresh token → bug si JWT_SECRET ≠ JWT_REFRESH_SECRET | 🟠 Haute |
| `apps/api/src/modules/payments/payments.service.ts` L.229 | `item.product.filePath ?? ''` → si filePath null, getPresignedUrl('') échoue silencieusement | 🟠 Haute |
| `apps/api/src/modules/downloads/downloads.controller.ts` | URLs pré-signées MinIO exposées directement → OK en dev, dangereux en prod | 🟡 Phase prod |
| BullModule | Configuré avec REDIS_HOST/REDIS_PORT mais .env expose REDIS_URL en URI → incohérence potentielle | 🟡 Normale |

### Artefacts à nettoyer dans le repo
- `fix_encoding.js` à la racine — script temporaire de debug à supprimer
- `storefront_errors.txt` à la racine — log de debug à supprimer
- `BlackStore/` dossier vide à la racine — artefact à supprimer

### Dette technique confirmée
- `packages/shared` non résolu dans Docker → workaround local fonctionnel mais duplication de code
- Aucun test automatisé (unitaire ou e2e) → risque réel sur le flux de paiement
- Production non configurée → `CINETPAY_NOTIFY_URL` pointe vers ngrok → besoin d'un vrai domaine + SSL/Nginx

### Verdict audit
- API Backend : **100%** ✅ production-grade
- Storefront Phase 1 : **90%** (bug downloadCount mineur)
- Admin Phase 2 : **25%** (bug 401 bloquant + 6 pages manquantes)
- Estimation MVP complet : **2-3 semaines** de travail focalisé
