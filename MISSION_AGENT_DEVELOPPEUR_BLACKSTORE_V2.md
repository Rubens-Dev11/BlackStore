# MISSION AGENT — PROJET BLACKSTORE V2
# Rôle : Prompt Architect AI + Développeur Senior Full Stack
# Date : 25 juin 2026
# Porteur du projet : Rubens

---

## TON RÔLE EXACT

Tu n'es pas seulement un architecte qui génère des prompts.
Dans cette session, tu es **à la fois** :

- **Prompt Architect AI** — tu conçois les solutions, tu structures le travail
- **Développeur Senior Full Stack** — tu écris et corriges le code toi-même
  directement dans les fichiers du projet sans passer par Cursor

**Lis intégralement `PASSATION_BLACKSTORE_25_JUIN_2026.md` avant de commencer.**

---

## TA MÉTHODE DE TRAVAIL — RÈGLE ABSOLUE

```
POUR CHAQUE BUG OU FONCTIONNALITÉ :
  1. Analyser le problème (lire les fichiers concernés)
  2. Écrire la correction directement dans le fichier
  3. Tester dans le navigateur OU vérifier les logs Docker
  4. Si ✅ → passer au suivant
  5. Si ❌ → diagnostiquer + corriger + retester
     (boucle jusqu'à ce que le test soit vert)
  6. NE JAMAIS passer à l'étape suivante sans validation confirmée
```

**Tu ne passes JAMAIS à une correction suivante sans avoir confirmé
que la précédente fonctionne. Jamais.**

---

## CONTEXTE RAPIDE

BlackStore est une plateforme e-commerce de produits numériques pour le marché
camerounais. Elle comprend :
- Un **storefront** Next.js (localhost:3001) — 100% fonctionnel ✅
- Un **admin dashboard** React/Vite (localhost:3002) — 60% fonctionnel ⚠️
- Une **API NestJS** (localhost:3000) — 100% fonctionnelle ✅

L'agent précédent a bien avancé mais a atteint ses limites avec 1 bug bloquant
qui empêche tout le reste de fonctionner correctement.

---

## MISSION — ORDRE STRICT D'EXÉCUTION

### ÉTAPE 1 — CORRIGER LE BUG 401 (PRIORITÉ ABSOLUE)

C'est le bug le plus important. Tant qu'il n'est pas résolu, rien ne fonctionne
en admin : dashboard vide, toggle isActive cassé, badge "Inactif" qui ne change
jamais.

**Symptôme :**
```
GET http://localhost:3000/dashboard/stats → 401 Unauthorized
GET http://localhost:3000/dashboard/sales-chart → 401 Unauthorized
PATCH http://localhost:3000/products/:id → 401 Unauthorized
```

**Le token EST dans localStorage** — vérifié :
```javascript
JSON.parse(localStorage.getItem('blackstore-admin-auth')).state.accessToken
// → retourne un JWT valide
```

**Mais le header Authorization n'est pas envoyé dans les requêtes HTTP.**

**Diagnostic à faire EN PREMIER — lire apps/api/src/main.ts :**
La cause probable est une mauvaise config CORS dans NestJS.
Si `credentials: true` + `origin: '*'` → le navigateur bloque tout.
Si `credentials: 'include'` dans fetch + CORS mal configuré → 401 systématique.

**Actions dans l'ordre :**

**Action 1a — Lire main.ts et corriger le CORS :**
```typescript
// main.ts — configuration CORS correcte
app.enableCors({
  origin: ['http://localhost:3001', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```
Après modification → `docker compose up nestjs-api -d`

**Action 1b — Supprimer credentials: 'include' de api.ts :**
Dans `apps/admin/src/lib/api.ts`, retirer la ligne `credentials: 'include'`
car elle est inutile pour JWT Bearer et peut causer des problèmes CORS preflight.

**Action 1c — Vérifier dans Network le header Authorization :**
Après les corrections, ouvrir DevTools → Network → cliquer sur GET /dashboard/stats
→ Vérifier que `Authorization: Bearer eyJ...` est bien présent dans Request Headers
→ Si présent mais 401 → le JWT est expiré → se reconnecter

**Test de validation ÉTAPE 1 :**
- [ ] DevTools Network → GET /dashboard/stats → 200 ✅
- [ ] Dashboard affiche les 4 cartes stats + graphique ✅
- [ ] Toggle isActive → PATCH → 200 ✅
- [ ] Badge "Inactif" → "Actif" après toggle ✅
- [ ] Produit activé visible sur http://localhost:3001 ✅

**⚠️ Ne pas passer à l'étape 2 tant que ces 5 points ne sont pas ✅**

---

### ÉTAPE 2 — VALIDER LES PAGES CRÉÉES MAIS NON TESTÉES

L'agent précédent a créé ces pages sans pouvoir les tester.
Tu dois les tester et corriger si nécessaire.

**2a — Formulaire produit (product-form-page.tsx) :**

Test création :
```
http://localhost:3002/produits/nouveau
→ formulaire visible avec tous les champs
→ remplir : nom, slug, prix, plateforme, description courte
→ cliquer "Créer le produit"
→ POST /products → 201 Created
→ redirect vers /produits → nouveau produit dans la liste
```

Test édition :
```
http://localhost:3002/produits/{id}/modifier
→ formulaire prérempli avec les données du produit
→ modifier le prix
→ cliquer "Mettre à jour"
→ PATCH /products/:id → 200
→ redirect vers /produits → prix mis à jour
```

Si erreurs → corriger dans product-form-page.tsx jusqu'à ce que ça marche.

**Champs obligatoires pour POST /products (selon schéma Prisma) :**
```typescript
{
  name: string,
  slug: string,          // générer depuis name (lowercase, tirets)
  price: number,
  platform: 'android' | 'desktop' | 'multiplatform',
  shortDescription: string,
}
```

**2b — Page Commandes (orders-page.tsx) :**

Test :
```
http://localhost:3002/commandes
→ liste des commandes visible (au moins 1 commande de test)
→ colonnes : numéro, acheteur, montant, statut, date
→ export CSV fonctionne
```

Si erreurs → corriger dans orders-page.tsx.

**Endpoint API :**
```
GET /orders → nécessite Bearer token
Réponse : { data: Order[], total: number, ... }
```

**2c — Page Avis (reviews-page.tsx) :**

Test :
```
http://localhost:3002/avis
→ liste des avis visible (même si vide)
→ boutons Approuver / Supprimer présents
→ PATCH /reviews/:id/approve → 200
→ DELETE /reviews/:id → 200
```

**Test de validation ÉTAPE 2 :**
- [ ] /produits/nouveau → créer un produit → apparaît dans la liste ✅
- [ ] /produits/:id/modifier → modifier → mis à jour ✅
- [ ] /commandes → liste visible ✅
- [ ] /avis → liste visible ✅

---

### ÉTAPE 3 — DÉVELOPPER CE QUI MANQUE

**3a — Page Analytics :**

Créer `apps/admin/src/pages/analytics-page.tsx`

Endpoint : `GET /dashboard/analytics` → nécessite Bearer token
Afficher : graphiques de vues par produit, sources UTM

Mettre à jour router.tsx :
```typescript
import { AnalyticsPage } from '@/pages/analytics-page';
// Remplacer PlaceholderPage pour /analytics
<Route path="/analytics" element={<AnalyticsPage />} />
```

**3b — Upload fichier produit (Produits 3C) :**

Dans product-form-page.tsx, ajouter section upload :
```
POST /products/:id/upload-file
→ FormData avec le fichier
→ après succès : afficher le nom du fichier uploadé

POST /products/:id/upload-screenshots
→ FormData avec les screenshots (multiple)
→ après succès : afficher les miniatures
```

**Test de validation ÉTAPE 3 :**
- [ ] /analytics → graphiques visibles ✅
- [ ] Upload fichier produit → fichier enregistré ✅

---

### ÉTAPE 4 — TEST GLOBAL COMPLET

Quand toutes les étapes précédentes sont validées, tester TOUS les flux
en simultané pour confirmer que rien n'est cassé.

**Flux Storefront (localhost:3001) :**
- [ ] Homepage → produits actifs visibles avec catégories et filtres
- [ ] Filtre par catégorie → fonctionne côté client
- [ ] Recherche → fonctionne côté client
- [ ] Cliquer produit → fiche produit s'ouvre
- [ ] "Ajouter au panier" → badge panier se met à jour
- [ ] /panier → produit dans la liste avec total FCFA
- [ ] /commande → formulaire visible
- [ ] Remplir + soumettre → commande BS-2026-XXXXX créée
- [ ] Redirect CinetPay (erreur 400 attendue avec fausses clés)
- [ ] /commande/succes → sans sessionStorage → redirect /
- [ ] /commande/echec → page d'échec visible
- [ ] /commande/en-attente → sans sessionStorage → redirect /

**Flux Admin (localhost:3002) :**
- [ ] /login → formulaire avec style sombre
- [ ] Login admin@blackstore.cm / Admin@BlackStore2026! → redirect /dashboard
- [ ] Refresh → reste connecté (localStorage persist)
- [ ] /dashboard → 4 cartes stats + graphique ventes
- [ ] /produits → liste avec toggles et badges
- [ ] Toggle isActive ON → badge "Actif" → produit visible sur :3001
- [ ] Toggle isActive OFF → badge "Inactif" → produit disparu de :3001
- [ ] /produits/nouveau → créer produit → visible dans liste
- [ ] /categories → 4 catégories, modifier, supprimer
- [ ] /commandes → liste des commandes
- [ ] /avis → liste des avis, approuver, supprimer
- [ ] /analytics → graphiques
- [ ] Déconnexion → redirect /login
- [ ] Accès /dashboard sans token → redirect /login

**Flux API (Swagger localhost:3000/docs) :**
- [ ] GET /products → { data: [...], total: N }
- [ ] GET /categories → liste
- [ ] GET /dashboard/stats → stats (avec token)

---

## RAPPORT FINAL OBLIGATOIRE

À la fin de ta session, tu DOIS fournir ce rapport complet :

```markdown
# RAPPORT DE SESSION — BLACKSTORE
# Date : [date]
# Agent : [ton identifiant]

## RÉSUMÉ EXÉCUTIF
[2-3 phrases sur ce qui a été accompli]

## BUGS CORRIGÉS
| Bug | Cause racine | Solution appliquée | Statut |
|-----|-------------|-------------------|--------|
| 401 Unauthorized | [cause] | [solution] | ✅/❌ |

## FONCTIONNALITÉS DÉVELOPPÉES
| Fonctionnalité | Fichiers créés/modifiés | Statut |
|----------------|------------------------|--------|
| Analytics page | analytics-page.tsx | ✅/❌ |
| Upload fichier | product-form-page.tsx | ✅/❌ |

## TEST GLOBAL — RÉSULTATS DÉTAILLÉS
| Flux | Statut | Notes |
|------|--------|-------|
| Homepage storefront | ✅/❌ | ... |
| Fiche produit | ✅/❌ | ... |
| Panier → checkout | ✅/❌ | ... |
| Login admin | ✅/❌ | ... |
| Dashboard stats | ✅/❌ | ... |
| Toggle isActive | ✅/❌ | ... |
| Formulaire produit | ✅/❌ | ... |
| Catégories CRUD | ✅/❌ | ... |
| Commandes liste | ✅/❌ | ... |
| Avis modération | ✅/❌ | ... |
| Analytics | ✅/❌ | ... |
| Déconnexion | ✅/❌ | ... |

## CE QUI RESTE À FAIRE
[Liste précise et ordonnée]

## NOUVEAUX PROBLÈMES DÉCOUVERTS
[Tout nouveau bug ou comportement inattendu]

## RECOMMANDATIONS POUR L'AGENT SUIVANT
[Conseils basés sur ce que tu as appris]
```

---

## RAPPEL DES RÈGLES TECHNIQUES

1. `@blackstore/shared` → JAMAIS → toujours `@/lib/format`
2. `GET /products` → sans query params → filtrage côté client
3. `docker --build` → UNIQUEMENT si package.json ou Dockerfile modifié
4. Noms services : `nestjs-api`, `nextjs-storefront`, `react-admin`
5. TypeScript strict → toujours typer explicitement
6. `enabled: !!accessToken` → sur toutes les requêtes protégées
7. `_hasHydrated` → vérifier avant de rendre les routes protégées
8. Ports : 5433 (postgres), 8027 (mailhog) — ne pas changer
9. Champs Prisma → se référer à la section 3 du document de passation
10. Une modification → un test → validation avant de continuer

---

## ACCÈS RAPIDE

```
Admin : admin@blackstore.cm / Admin@BlackStore2026!

localhost:3000/docs  → Swagger API
localhost:3001       → Storefront
localhost:3002       → Admin Dashboard
localhost:8027       → MailHog
localhost:9001       → MinIO Console
localhost:5433       → PostgreSQL
```

---

*Mission générée le 25 juin 2026*
*Projet : BlackStore v2.0 — Marché Cameroun & Afrique*
*Porteur : Rubens*
*État au démarrage : API 100% ✅ | Storefront 100% ✅ | Admin 60% ⚠️*

---

## POINTS CRITIQUES ISSUS DE L'AUDIT (à ne pas oublier)

### Vérification CORS dans main.ts — PREMIÈRE ACTION

L'audit confirme que le CORS n'est pas visible dans les fichiers lus.
C'est la **cause la plus probable du bug 401**.

Lire immédiatement `apps/api/src/main.ts` et vérifier :
```typescript
// ❌ Configuration qui cause le 401 :
app.enableCors({ origin: '*', credentials: true });
// → incompatible : credentials: true interdit avec origin: '*'

// ✅ Configuration correcte :
app.enableCors({
  origin: ['http://localhost:3001', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

Après correction CORS → `docker compose up nestjs-api -d`
Puis supprimer `credentials: 'include'` de `apps/admin/src/lib/api.ts`
(inutile pour JWT Bearer, peut interférer avec CORS)

### Sécurité — auth.service.ts à vérifier

Le refresh token utilise peut-être le mauvais secret.
Vérifier que `jwtService.verify(token, { secret: process.env.JWT_REFRESH_SECRET })`
est bien explicitement configuré dans auth.service.ts.

### Artefacts à nettoyer (non bloquants)
- Supprimer `fix_encoding.js` à la racine
- Supprimer `storefront_errors.txt` à la racine
