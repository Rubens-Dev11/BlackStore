# Essais de bout en bout

Ces essais appellent l'API (port 3100) et la boutique (port 3001) comme le feraient un client, un vendeur et
l'administrateur, sur une base de test jetable. Ils vérifient chaque fonctionnalité : comptes vendeurs,
boutiques, produits et antivirus, signalements, identité, portefeuille et retraits, vidéos, textes légaux,
sauvegardes, messages d'erreur, litiges, espace client, mot de passe admin, codes promo, statistiques.

Aucun secret n'est enregistré ici : `setup-test-env.sh` tire des mots de passe de test au hasard à chaque
lancement (fichiers `test.env` et `api.env`, ignorés par Git).

## Prérequis

- Docker Desktop lancé (conteneurs `bs-test-*` : PostgreSQL, Redis, MinIO, MailHog, liés à 127.0.0.1) ;
- Git Bash, Node.js ;
- l'API construite : `npm run build` dans `apps/api` ;
- la boutique construite pour l'API de test :
  `NEXT_PUBLIC_API_URL=http://localhost:3100 API_URL=http://localhost:3100 npx next build` dans `apps/storefront`.

## Lancer

```bash
bash tests/e2e/setup-test-env.sh
```

Puis, dans `tests/e2e` : démarrer le faux antivirus (`node fake-clamd.mjs`) et le faux CinetPay
(`node fake-cinetpay.mjs`), la boutique (`npx next start -p 3001` dans `apps/storefront`, avec les mêmes
variables), et enfin :

```bash
bash tests/e2e/run-regressions.sh
```

Le résumé s'affiche à la fin (fichier `resume.txt`) et le détail est dans `regressions.log`. La série complète
dure environ 25 minutes : des pauses de 65 secondes respectent la limite d'inscriptions de vendeurs par minute.

## À savoir

- Un essai seul : `. ./api.env && node e2e-promo.mjs` (depuis `tests/e2e`, API démarrée).
- Les conteneurs de test portent le label `bs-test=1` :
  `docker ps -aq --filter label=bs-test=1 | xargs docker rm -f -v` les supprime.
- `e2e-admin-password.mjs` arrête MailHog un instant pour simuler une panne d'e-mail : ne pas lancer deux
  séries en même temps.
