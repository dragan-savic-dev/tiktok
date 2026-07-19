# TikTok Live Stats

Dashboard personale in stile "live counter" (come TokCount / Livecounts.io) per il **tuo** account TikTok, via OAuth ufficiale: nome e foto profilo, follower, seguiti, mi piace, e la somma su tutti i tuoi video pubblici di visualizzazioni / mi piace / commenti / condivisioni, aggiornata **ogni 5 secondi**.

**Nessun dato viene salvato**: i token OAuth vivono in cookie httpOnly nel browser, le statistiche in una cache in memoria del server (sparisce al riavvio). L'access token viene rinnovato automaticamente col refresh token (valido 365 giorni), quindi non serve riloggarsi.

## Configurazione TikTok (una tantum)

1. Vai su <https://developers.tiktok.com> e crea un'app (Manage apps → Connect an app).
2. Aggiungi i prodotti **Login Kit** e **Display API**, con gli scope:
   `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`.
3. Crea una **Sandbox** (menu in alto nella pagina dell'app): la sandbox funziona senza app review.
4. Nella sandbox, aggiungi il tuo username TikTok come **target user** (la propagazione può richiedere fino a 1 ora). Solo i target user possono autorizzare l'app.
5. TikTok accetta solo **redirect URI HTTPS registrati**, quindi `http://localhost:3000` non funziona. Avvia un tunnel HTTPS, ad esempio con ngrok (dominio statico gratuito):

   ```bash
   ngrok http 3000
   ```

6. In Login Kit (della sandbox) registra il redirect URI:
   `https://<tuo-dominio-ngrok>/api/auth/callback`
7. Copia **Client Key** e **Client Secret** della sandbox in `.env.local`:

   ```env
   TIKTOK_CLIENT_KEY=...
   TIKTOK_CLIENT_SECRET=...
   APP_URL=https://<tuo-dominio-ngrok>
   ```

## Avvio

```bash
npm install
npm run dev
```

Apri l'URL **https del tunnel** (non localhost, altrimenti i cookie `secure` non vengono salvati) e premi "Continua con TikTok".

## Database (Neon) — opzionale ma consigliato

Di default lo storico (snapshot della sezione **Crescita**, conteggi "salvati") vive su filesystem + `localStorage`, che su hosting serverless è effimero/per-dispositivo. Configurando un database **Neon** (Postgres serverless) lo storico diventa robusto, per-utente e sopravvive ai riavvii — ed è la base per le curve per-singolo-video (share rate nel tempo, velocità, ondate).

**Su Vercel (integrazione Neon):** collega Neon dal Marketplace/Storage del progetto — le variabili (`DATABASE_URL` o `POSTGRES_URL`, incluse le varianti unpooled) vengono iniettate automaticamente; il codice le riconosce da solo (`lib/db.ts`). In locale prendi la stessa stringa con `vercel env pull .env.local`, oppure incollala a mano:

```env
DATABASE_URL=postgresql://user:password@ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require
```

Passi:

1. (Se non su Vercel) crea un progetto gratuito su <https://neon.tech> e copia la **pooled connection string** (contiene `?sslmode=require`).
2. Riavvia `npm run dev`. Lo schema (`users`, `account_snapshots`, `videos`, `video_snapshots`, `video_saved`, `video_notes`) viene creato automaticamente al primo accesso al DB.
3. Nella pagina **Crescita** compare **"Sincronizza dal telefono"**: carica nel DB gli snapshot accumulati in `localStorage` su quel dispositivo. È **additivo e idempotente** (ON CONFLICT sul timestamp): il client **continua** a salvare in `localStorage` (registrazione continua al minuto) e puoi ripremere Sync quando vuoi per aggiornare il DB.

In DB finiscono **solo i dati storicizzati nel tempo** (serie temporali, salvati, note): i valori live delle API TikTok si prendono sempre freschi e non si duplicano.

Lo storico del DB arriva quindi da tre fonti che si fondono senza duplicati: poll ad app aperta (1/min), cron giornaliero (ad app chiusa) e Sync manuale dal `localStorage`.

### Raccolta ad app chiusa (Vercel Cron)

Su Vercel il filesystem è effimero e il processo non è persistente, quindi:

- gli **access token** degli utenti vengono salvati nel DB (tabella `users`), non su disco;
- un **Vercel Cron** (`vercel.json` → `/api/cron/collect`) storicizza anche quando nessuno ha l'app aperta. L'endpoint accetta solo la chiamata di Vercel se imposti la variabile **`CRON_SECRET`** (Vercel la inoltra come `Authorization: Bearer …`).
- Con l'app aperta, gli snapshot si scrivono comunque a ogni poll (throttlati a 1/min), quindi ad app aperta il DB è aggiornato al minuto a prescindere dal cron.

> Schedule attuale: **`0 3 * * *`** (una volta al giorno), compatibile con il piano **Vercel Hobby** (i cron Hobby girano max 1/giorno). Il fine-grained lo copri col poll ad app aperta e col bottone Sync. Se passi a **Vercel Pro** puoi mettere `* * * * *` per la raccolta al minuto anche ad app chiusa.

## Come funziona

- `app/api/auth/login` → redirect all'authorize di TikTok (`/v2/auth/authorize/`) con `state` anti-CSRF in cookie.
- `app/api/auth/callback` → verifica dello `state`, scambio `code` → token (`/v2/oauth/token/`), token salvati in cookie httpOnly.
- `app/api/stats` → chiamato dal client ogni 5s; rinnova l'access token se sta per scadere (margine 2 min, refresh token eventualmente ruotato viene ri-salvato), poi legge da una cache in memoria: user info (TTL 4,5s) e aggregato video (`/v2/video/list/` paginato 20 per pagina; TTL adattivo 4,5–30s in base al numero di video, per restare sotto il rate limit TikTok di 600 richieste/min per endpoint).
- `app/dashboard` → UI live: numeri con cifre a rullo (odometro), badge delta ±, indicatore LIVE con anello di progresso dei 5 secondi.

## PWA (installabile)

L'app è una PWA: dal browser (HTTPS) puoi installarla in home/desktop. Su Chrome/Edge/Android compare il prompt d'installazione (o il pulsante "Installa l'app" in home); su iOS usa Condividi → "Aggiungi a Home".

- Manifest generato da `app/manifest.ts`, icone in `public/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-icon-180.png`).
- Service worker servito da `app/sw.js/route.ts` (non da `public/`): così vi iniettiamo un ID di build (`NEXT_PUBLIC_BUILD_ID`, in `next.config.ts`: SHA del commit su Vercel, timestamp altrimenti). **Non intercetta mai `/api/*`**, quindi i contatori live continuano ad aggiornarsi ogni 5 secondi anche da app installata. Fa cache degli asset statici (stale-while-revalidate) e ha un fallback offline (`public/offline.html`).
- **Popup di aggiornamento**: quando pubblichi un nuovo deploy, cambiando l'ID di build cambiano i byte del SW → il browser rileva la nuova versione (controllo all'avvio, ogni 60s e al focus della tab) e compare un popup **"È disponibile una nuova versione · Aggiorna"**. Al click il SW in attesa fa `skipWaiting` e la pagina si ricarica sulla versione nuova. Il file `/sw.js` è servito con `Cache-Control: no-store` così non resta bloccato in cache.

Per rigenerare le icone: `node scripts/gen-icons.mjs public` — sono comunque già committate.

## Limiti (API ufficiale)

- Il conteggio **"salvati"** non è esposto dalla Display API (esiste solo nella Research API per ricercatori accreditati). Viene quindi ricavato via **scraping** del JSON incorporato nelle pagine pubbliche dei video (`collectCount`, vedi `lib/tiktok-scrape.ts`), sia come totale sia **per singolo video**, senza limite sul numero di video: a ogni ciclo (~1 minuto) si legge solo un **lotto di ~12 pagine a rotazione**, partendo dai video col dato più vecchio, così da non far scattare i blocchi anti-bot. Il totale compare quando la prima rotazione è completa; se TikTok blocca la lettura resta l'ultimo valore noto o "N/D" — il resto della dashboard non ne risente.
- Su hosting **serverless** (es. Vercel) il filesystem è effimero: per questo gli snapshot della sezione **Crescita** vengono salvati anche nel **localStorage del browser** (stesso downsampling dello storico server: minuto→48h, ora→14gg, giorno→120gg) e la pagina unisce le due fonti. I grafici sopravvivono così ai deploy, ma lo storico locale è per-dispositivo e cresce solo mentre l'app è aperta; lo stato della rotazione dello scraping riparte comunque a freddo. Con un server persistente (VPS, container) anche lo storico server sopravvive.
- Le **views totali del profilo** non esistono come campo: le "Visualizzazioni" mostrate sono la somma delle view dei tuoi video **pubblici** (i privati non vengono restituiti dall'API).
- Per pubblicare l'app in produzione (fuori sandbox) serve l'app review di TikTok: demo video del flusso, sito reale con privacy policy e ToS, verifica del dominio.
