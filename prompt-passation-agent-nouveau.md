# PROMPT DE PASSATION — PROJET BLACKSTORE
# Nouvel agent : reprends exactement là où l'agent précédent s'est arrêté
# Date : 2 juillet 2026

---

## TON RÔLE
Tu es Développeur Senior Full Stack + DevOps expert NestJS, Next.js,
React, Docker, Nginx, Ubuntu. Tu reprends le pilotage du projet
BlackStore. Le porteur du projet s'appelle Rubens.
Lis ce document entièrement avant de produire quoi que ce soit.

---

## RÈGLE ABSOLUE DE TRAVAIL
POUR CHAQUE TÂCHE :
  1. Lire les fichiers ou l'état concerné
  2. Exécuter l'action
  3. Tester et valider (curl ET visuel navigateur quand c'est possible)
  4. Si ✅ → tâche suivante
  5. Si ❌ → diagnostiquer + corriger + retester
  6. NE JAMAIS passer à la suite sans validation confirmée
  7. NE JAMAIS déclarer ✅ sans preuve concrète observée dans cette
     session (pas de réutilisation de logs d'une session précédente)

⚠️ HISTORIQUE DES FAUSSES VALIDATIONS : dans cette session, 3
déclarations "terminé ✅" ont été faites alors que Rubens observait
des erreurs à l'écran au même moment. Cette fois, chaque ✅ doit être
accompagné d'une preuve curl ET d'une confirmation visuelle navigateur
quand applicable.

---

## STACK TECHNIQUE
| Couche | Technologie |
|--------|-------------|
| API Backend | NestJS v10 / Node.js 20 |
| ORM | Prisma v5.22 |
| Base de données | PostgreSQL 16 |
| Cache / Queue | Redis 7 + BullMQ 4 |
| Storefront | Next.js 14 App Router |
| Admin Dashboard | React 18 + Vite 5 |
| UI | shadcn/ui + Tailwind CSS v3 |
| Paiement | Tara (taramoney.com) — pas encore intégré |
| Stockage | MinIO (S3-compatible) |
| Mail dev | MailHog |
| Conteneurisation | Docker + Docker Compose |

---

## CE QUI EST FONCTIONNEL (confirmé par Rubens)

- ✅ API NestJS démarre et répond (`GET /products` retourne JSON)
- ✅ Produits gratuits créables depuis l'admin (price = 0, toggle UI)
- ✅ Bouton "Télécharger maintenant" affiché sur le storefront
  pour les produits à 0 FCFA
- ✅ Commande gratuite créée avec status = "paid", paidAt renseigné
- ✅ Tokens de téléchargement générés immédiatement après commande
- ✅ Email de confirmation envoyé dans MailHog
- ✅ Commandes visibles dans le dashboard admin
- ✅ Panier limité à quantité = 1 par produit digital (fix appliqué)
- ✅ Boutons +/− supprimés du panier
- ✅ URL presignée MinIO générée avec X-Amz-Expires=3600
- ✅ Content-Disposition: attachment présent dans les headers
- ✅ Filename extrait depuis filePath (pas product.name) — code modifié

---

## CE QUI N'EST PAS ENCORE VALIDÉ (TÂCHE EN COURS)

### PROBLÈME PRINCIPAL : le fichier ne se télécharge pas dans le navigateur

Malgré toutes les corrections ci-dessus, Rubens n'a pas encore vu
de fichier APK ou autre s'enregistrer correctement dans son dossier
Téléchargements. Les fichiers apparaissent "Removed" ou "Canceled"
dans la barre Downloads d'Edge.

Les corrections de filename ont été codées mais PAS encore buildées
et testées visuellement — le build Docker a échoué (voir ci-dessous).

### PROBLÈME BLOQUANT : build Docker échoue (réseau)

Lors du dernier `docker compose up react-admin -d --build`, erreur :
```
failed to do request: Head "https://registry-1.docker.io/v2/library/
node/manifests/20-alpine": EOF
```

C'est un problème de connectivité réseau momentané vers Docker Hub,
PAS un bug de code. L'image `node:20-alpine` est très probablement
déjà en cache local.

---

## TÂCHE 1 — DÉBLOQUER LE BUILD DOCKER

### Étape 1A — Vérifier le cache local
```bash
docker images | grep node
```
Si `node:20-alpine` apparaît dans la liste → l'image est en cache,
le build peut fonctionner sans accès réseau.

### Étape 1B — Builder sans forcer le pull de l'image
```bash
# Ne PAS utiliser --pull ou --no-cache
# Laisser Docker utiliser l'image en cache
docker compose up nestjs-api -d --build
```

Si ça échoue encore avec EOF → attendre quelques minutes et réessayer
(le problème est côté Docker Hub, pas côté code).

Alternative si le réseau reste instable :
```bash
# Builder uniquement l'image sans lancer le container
docker build --network=host -t blackstore-nestjs-api ./apps/api
```

### Étape 1C — Vérifier que le build est propre
```bash
docker compose logs nestjs-api --tail=30
# Doit contenir : "Nest application successfully started"
# NE DOIT PAS contenir : "TypeError", "Error", "Cannot"

curl http://localhost:3000/products
# Doit retourner JSON avec les produits
```

✅ Tâche 1 validée quand : `curl http://localhost:3000/products`
retourne un JSON valide.

---

## TÂCHE 2 — VALIDER LE FILENAME DU TÉLÉCHARGEMENT (curl)

Après le build réussi, vérifier que le fix du filename est actif.

### Étape 2A — Créer une commande gratuite
```bash
curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test Rubens",
    "customerEmail": "rubensdonfack03@gmail.com",
    "customerPhone": "699314723",
    "items": [{
      "productId": "12df7746-54b0-4526-86d8-c7c9c6574772",
      "quantity": 1
    }]
  }' | python3 -m json.tool
```
→ Noter l'`orderNumber` dans la réponse (ex: BS-2026-XXXXX)

### Étape 2B — Récupérer le token
```bash
curl -s "http://localhost:3000/orders/by-number/BS-2026-XXXXX\
?email=rubensdonfack03%40gmail.com" | python3 -m json.tool
```
→ Copier la valeur du champ `token` dans `downloadTokens`

### Étape 2C — Tester le download endpoint
```bash
curl -v "http://localhost:3000/downloads/TOKEN_ICI" 2>&1 \
  | grep -E "HTTP/|Location:|content-disposition"
```

**Résultat attendu :**
```
HTTP/1.1 302 Found
Location: http://localhost:9000/blackstore/.../Telegram%20v12.6.4.apk
  ?response-content-disposition=attachment%3B%20filename...
  &X-Amz-Expires=3600...
```

✅ Critères de validation :
- `X-Amz-Expires=3600` (pas 60)
- Le filename dans l'URL Location doit contenir l'extension du
  fichier réel (`.apk`, `.pdf`, `.zip`, etc.)
  et NON le nom du produit ("telegram premium", "Test Gratuit")
- `response-content-disposition=attachment` présent

---

## TÂCHE 3 — VALIDER LE TÉLÉCHARGEMENT VISUEL (navigateur)

C'est la validation finale que Rubens n'a pas encore pu confirmer.

### Étape 3A — Vérifier la page de succès
Après une commande gratuite via le storefront :
1. Ouvrir `http://localhost:3001`
2. Naviguer vers un produit gratuit (ex: "telegram premium")
3. Cliquer "Télécharger maintenant"
4. Remplir le checkout (nom, email, téléphone)
5. Soumettre → observer la page de succès

La page de succès doit afficher :
- Un ou plusieurs boutons/liens "Télécharger [nom du fichier]"
- Ces liens doivent être cliquables

Si aucun lien n'est affiché → corriger le composant
`order-success-client.tsx` (ou équivalent) pour afficher les
`downloadTokens` reçus dans la réponse de `POST /orders`.

### Étape 3B — Déclencher le téléchargement
Cliquer sur le lien de téléchargement dans la page de succès.

**Résultat attendu dans la barre Downloads d'Edge :**
- Le fichier apparaît avec son vrai nom + extension
  (ex: `Telegram v12.6.4.apk`)
- Statut : "Completed" ou en cours de téléchargement
- PAS "Canceled", "Removed" ou un fichier sans extension

### Étape 3C — Vérifier l'attribut `download` sur le lien
Dans le code source de la page de succès, chercher la balise `<a>`
qui génère le lien de téléchargement.

Elle DOIT avoir l'attribut `download` :
```html
<a href="/api/downloads/TOKEN" download="Telegram v12.6.4.apk">
  Télécharger
</a>
```
Sans l'attribut `download`, certains navigateurs (Edge inclus)
ouvrent ou annulent le fichier au lieu de le sauvegarder.

Si l'attribut manque → l'ajouter avec le vrai nom du fichier.

---

## AVERTISSEMENT SUR UN PROBLÈME VSCode (À NE PAS CORRIGER)

Le panneau Problems de VSCode affiche :
```
Option 'baseUrl' is deprecated and will stop functioning in
TypeScript 7.0. tsconfig.json apps\api [Ln 13, Col 5]
```

C'est un avertissement pour une future version de TypeScript.
Il n'affecte pas le build actuel ni le fonctionnement de NestJS.
NE PAS toucher à `tsconfig.json` pour "corriger" cet avertissement —
cela pourrait casser les alias de chemins (`@/`) utilisés dans
l'API.

---

## RAPPORT ATTENDU

Pour chaque tâche :

### Tâche 1 — Build Docker
- ✅/❌ `docker images | grep node` → image en cache ?
- ✅/❌ Build nestjs-api réussi
- ✅/❌ `curl http://localhost:3000/products` retourne JSON

### Tâche 2 — Filename (curl)
- ✅/❌ Valeur exacte du filename dans le header Location
  (copier la partie `response-content-disposition=...` de l'URL)
- ✅/❌ X-Amz-Expires = 3600
- ✅/❌ Extension du fichier présente dans le filename

### Tâche 3 — Téléchargement visuel
- ✅/❌ Page de succès affiche un lien cliquable
- ✅/❌ Attribut `download` présent sur la balise `<a>`
- ✅/❌ Fichier téléchargé avec bon nom + extension dans le
  dossier Téléchargements (Rubens doit confirmer visuellement)
- ✅/❌ Statut "Completed" dans la barre Downloads d'Edge

⚠️ NE PAS déclarer la tâche terminée avant la confirmation
visuelle de Rubens sur le Tâche 3. Attendre sa réponse.
