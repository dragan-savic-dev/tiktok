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

## Come funziona

- `app/api/auth/login` → redirect all'authorize di TikTok (`/v2/auth/authorize/`) con `state` anti-CSRF in cookie.
- `app/api/auth/callback` → verifica dello `state`, scambio `code` → token (`/v2/oauth/token/`), token salvati in cookie httpOnly.
- `app/api/stats` → chiamato dal client ogni 5s; rinnova l'access token se sta per scadere (margine 2 min, refresh token eventualmente ruotato viene ri-salvato), poi legge da una cache in memoria: user info (TTL 4,5s) e aggregato video (`/v2/video/list/` paginato 20 per pagina; TTL adattivo 4,5–30s in base al numero di video, per restare sotto il rate limit TikTok di 600 richieste/min per endpoint).
- `app/dashboard` → UI live: numeri con cifre a rullo (odometro), badge delta ±, indicatore LIVE con anello di progresso dei 5 secondi.

## Limiti (API ufficiale)

- Il conteggio **"salvati"** non è esposto dalla Display API (esiste solo nella Research API per ricercatori accreditati). Viene quindi ricavato via **scraping** del JSON incorporato nelle pagine pubbliche dei video (`collectCount`, vedi `lib/tiktok-scrape.ts`), aggiornato circa ogni minuto. È fragile per natura: se TikTok cambia il markup o blocca l'IP del server (frequente sugli IP dei datacenter come quelli di Vercel), la card mostra l'ultimo valore noto o "N/D" — il resto della dashboard non ne risente.
- Le **views totali del profilo** non esistono come campo: le "Visualizzazioni" mostrate sono la somma delle view dei tuoi video **pubblici** (i privati non vengono restituiti dall'API).
- Per pubblicare l'app in produzione (fuori sandbox) serve l'app review di TikTok: demo video del flusso, sito reale con privacy policy e ToS, verifica del dominio.
