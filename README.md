# Agent IA WhatsApp — Agence Immobilière (démo Loom)

Webhook qui reçoit les messages WhatsApp via **Green API**, ne répond
**qu'au numéro `+2290144220259`**, génère une réponse avec **Groq**
(personnalité d'agent immobilier chaleureux), et renvoie la réponse via
Green API. Conçu pour tourner en serverless sur **Vercel**.

## Structure

```
api/webhook.js       -> endpoint Vercel (POST /api/webhook)
lib/config.js         -> lecture des variables d'environnement
lib/whitelist.js       -> filtrage strict du numéro
lib/systemPrompt.js    -> personnalité de l'agent (prompt système Groq)
lib/groq.js            -> appel Groq (chat completion)
lib/whatsapp.js        -> envoi de message via Green API
lib/history.js         -> historique optionnel (Upstash Redis), no-op si non configuré
scripts/local-server.js -> mini serveur pour tester sans Vercel CLI
scripts/payload-allowed.json / payload-blocked.json -> payloads de test
```

## 1. Prérequis

- Un compte [Green API](https://green-api.com/) avec une instance WhatsApp
  connectée (scanner le QR code avec le téléphone qui possède
  `+2290144220259`, **ou** un numéro de test que Green API attribue en
  plan freemium — vérifie que ce numéro correspond bien à celui que tu
  whitelistes).
- Une clé API [Groq](https://console.groq.com/) (gratuite).
- Un compte [Vercel](https://vercel.com/).
- Node.js 18+ en local.

## 2. Configuration

```bash
cp .env.example .env
```

Remplis `.env` avec :
- `GREEN_API_ID_INSTANCE` / `GREEN_API_TOKEN_INSTANCE` : dans ton dashboard Green API.
- `GROQ_API_KEY` : dans console.groq.com.
- `ALLOWED_WHATSAPP_NUMBER=+2290144220259` (déjà la valeur par défaut).
- `AGENCY_NAME`, `AGENT_FIRST_NAME` : personnalisables pour la démo.
- Laisse `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` vides pour
  rester 100% stateless (recommandé pour une démo Loom).

## 3. Test en local (sans Vercel CLI)

```bash
npm install
npm run start:local
```

Dans un autre terminal :

```bash
# Numéro whitelisté -> doit générer une vraie réponse Groq et l'envoyer via Green API
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d @scripts/payload-allowed.json

# Numéro NON whitelisté -> doit renvoyer {"ok":true} sans rien envoyer sur WhatsApp
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d @scripts/payload-blocked.json
```

Vérifie dans les logs du serveur (`npm run start:local`) qu'aucun appel
`sendMessage` n'est fait pour le second cas.

Tu peux aussi utiliser `vercel dev` à la place de `npm run start:local`
si tu préfères reproduire l'environnement Vercel à l'identique.

## 4. Déploiement sur Vercel

```bash
npm i -g vercel   # si pas déjà installé
vercel login
vercel link       # crée/associe le projet
```

Ajoute les variables d'environnement en secrets Vercel (une fois, ou via
le dashboard Vercel > Settings > Environment Variables) :

```bash
vercel env add GREEN_API_ID_INSTANCE
vercel env add GREEN_API_TOKEN_INSTANCE
vercel env add GROQ_API_KEY
vercel env add ALLOWED_WHATSAPP_NUMBER
vercel env add AGENCY_NAME
vercel env add AGENT_FIRST_NAME
# optionnel :
vercel env add GREEN_API_WEBHOOK_TOKEN
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
```

Déploie :

```bash
vercel --prod
```

Note l'URL de production, ex. `https://whatsapp-agent-immo.vercel.app`.
Ton endpoint webhook est :

```
https://whatsapp-agent-immo.vercel.app/api/webhook
```

## 5. Brancher Green API sur le webhook Vercel

Dans le dashboard Green API, sur ton instance :
1. Va dans **Settings** (ou **Webhooks**).
2. Renseigne **Webhook URL** = `https://whatsapp-agent-immo.vercel.app/api/webhook`.
3. Active `incomingMessageReceived` (les autres types de webhooks peuvent
   rester désactivés pour limiter les appels sur le plan freemium).
4. Si tu utilises `GREEN_API_WEBHOOK_TOKEN`, ajoute-le comme paramètre
   d'URL ou header selon ce que permet ton plan Green API (sinon laisse
   ce champ vide — le filtrage par numéro reste actif de toute façon).

## 6. Test réel pour la démo Loom

1. Envoie un message WhatsApp depuis `+2290144220259` vers le numéro
   connecté à ton instance Green API.
2. L'agent doit répondre en quelques secondes, avec le ton chaleureux
   défini dans `lib/systemPrompt.js`.
3. Envoie ensuite un message depuis un **autre** numéro : aucune réponse
   ne doit arriver (c'est le point clé à montrer dans la démo).
4. Consulte les logs Vercel (`vercel logs <url> --follow`) pendant
   l'enregistrement pour montrer le traitement en direct si utile.

## Limites du plan freemium à garder en tête

- **Green API freemium** : quota de messages/jour limité et une seule
  instance active — largement suffisant pour une démo Loom, mais ne pas
  boucler des tests automatisés en masse dessus.
- **Groq freemium** : limites de requêtes par minute selon le modèle
  (`GROQ_MODEL` par défaut : `llama-3.3-70b-versatile`). Le code ne fait
  qu'un seul appel Groq par message reçu, pas de retry automatique.
- Le service est **stateless par défaut** (pas d'historique conservé
  entre les messages) sauf si tu configures Upstash Redis — dans ce cas
  seuls les 6 derniers échanges par numéro sont gardés, avec une
  expiration de 6h, pour rester léger.

## 7. Prise de rendez-vous automatique (Google Calendar)

L'agent peut créer un événement dans un Google Calendar dès que le
prospect confirme une date et une heure précises pour une visite —
Groq déclenche cette action lui-même (function calling), tu n'as rien
à faire côté conversation.

### Créer le compte de service Google

1. Va sur [console.cloud.google.com](https://console.cloud.google.com/), crée un projet (ou réutilise un existant).
2. Active l'**API Google Calendar** (menu "APIs & Services" > "Library" > cherche "Google Calendar API" > Enable).
3. Va dans "APIs & Services" > "Credentials" > "Create Credentials" > "Service Account". Donne-lui un nom (ex: `whatsapp-immo`), pas besoin de rôle particulier au niveau projet.
4. Une fois créé, ouvre le compte de service > onglet "Keys" > "Add Key" > "Create new key" > format **JSON**. Un fichier `.json` se télécharge.
5. Dans ce fichier JSON, note `client_email` et `private_key`.

### Partager ton agenda avec le compte de service

1. Ouvre [calendar.google.com](https://calendar.google.com/), va dans les paramètres du calendrier que tu veux utiliser (ton calendrier principal, ou un calendrier dédié "RDV Agence").
2. Section "Partager avec des personnes" > ajoute l'adresse `client_email` du compte de service (ex: `whatsapp-immo@ton-projet.iam.gserviceaccount.com`), avec la permission **"Apporter des modifications aux événements"**.
3. Note l'**ID du calendrier** (dans les mêmes paramètres, section "Intégrer le calendrier") — c'est `primary` si c'est ton calendrier principal, sinon une adresse du type `xxxxx@group.calendar.google.com`.

### Configurer les variables d'environnement

Sur Vercel, ajoute :
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` : le `client_email` du JSON
- `GOOGLE_PRIVATE_KEY` : le `private_key` du JSON, collé tel quel (les `\n` restent des caractères littéraux dans le champ Vercel, le code les reconvertit automatiquement en vrais retours à la ligne)
- `GOOGLE_CALENDAR_ID` : l'ID relevé plus haut
- `GOOGLE_CALENDAR_TIMEZONE` : `Africa/Porto-Novo` par défaut (déjà la bonne valeur pour le Bénin)

Redéploie, puis teste : dis à l'agent une date et une heure précises
("Le vendredi 21 août à 15h, ça vous va ?" / "Oui parfait" ou équivalent
direct comme "Vendredi 21 août 15h ça me va") — un événement doit
apparaître dans ton Google Calendar, avec un rappel 30 min avant.



Tout se passe dans `lib/systemPrompt.js`. Modifie le ton, les questions
de qualification, les règles de style selon l'identité de l'agence.
`AGENCY_NAME` et `AGENT_FIRST_NAME` (variables d'env) sont injectés
directement dans le prompt.
