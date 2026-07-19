// i18n leggero, adatto alla dashboard (tutta client). La lingua di default è
// l'INGLESE: nei componenti si scrive direttamente il testo inglese, che fa da
// chiave. Il dizionario `it` mappa "testo inglese" -> "testo italiano"; se una
// chiave manca, si mostra l'inglese (fallback naturale, niente stringhe rotte).

import { es } from "./es";

export type Locale = "en" | "it" | "es";
export const LOCALES: Locale[] = ["en", "it", "es"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "it" || v === "es";
}

/** Dizionario Italiano: chiave = testo inglese (fonte), valore = italiano. */
export const it: Record<string, string> = {
  // --- Navigazione / chrome ---
  Overview: "Panoramica",
  Growth: "Crescita",
  Videos: "Video",
  Analytics: "Analisi",
  Dashboard: "Dashboard",
  "Log out": "Esci",
  Profile: "Profilo",
  "Open menu": "Apri menu",
  "Close menu": "Chiudi menu",

  // --- Live indicator ---
  LIVE: "LIVE",
  RETRYING: "RIPROVO",
  "Auto-refresh every 5 seconds": "Aggiornamento automatico ogni 5 secondi",

  // --- Install button ---
  "Install the app": "Installa l’app",
  Install: "Installa",
  Share: "Condividi",
  "“Add to Home Screen”": "“Aggiungi a Home”",
  "To install the app: tap": "Per installare l’app: tocca",
  "and then": "e poi",

  // --- Sync button ---
  Sync: "Sincronizza",
  "Syncing…": "Sincronizzo…",
  "to DB": "nel DB",
  "already up to date": "già aggiornato",
  "sync error": "errore sync",
  "Sync to the database the snapshots saved on this device":
    "Sincronizza nel database gli snapshot salvati su questo dispositivo",

  // --- Loading / errori ---
  "Loading your stats…": "Carico le tue statistiche…",
  "Loading the video…": "Carico il video…",
  "Loading history…": "Carico lo storico…",
  "Update error:": "Errore nell’aggiornamento:",
  "retrying in 5 seconds.": "nuovo tentativo tra 5 secondi.",
  "N/A": "N/D",

  // --- Landing ---
  "Sign in with your TikTok account and watch followers, views, likes, comments and shares across all your videos update in real time, every 5 seconds.":
    "Accedi col tuo account TikTok e guarda follower, visualizzazioni, mi piace, commenti e condivisioni di tutti i tuoi video aggiornarsi in tempo reale, ogni 5 secondi.",
  "Continue with TikTok": "Continua con TikTok",
  "No data is stored: access tokens live in httpOnly cookies and stats in a temporary in-memory cache.":
    "Nessun dato viene salvato: i token di accesso vivono in cookie httpOnly e le statistiche in una cache temporanea in memoria.",
  "You denied access on TikTok.": "Hai negato l’accesso su TikTok.",
  "Security check failed: try again.": "Verifica di sicurezza non superata: riprova.",
  "Couldn’t complete sign-in: try again.":
    "Non sono riuscito a completare l’accesso: riprova.",
  "Your session expired: sign in again.": "La sessione è scaduta: accedi di nuovo.",
  "An error occurred: try again.": "Si è verificato un errore: riprova.",

  // --- Metriche comuni ---
  Views: "Visualizzazioni",
  Viewers: "Spettatori",
  Likes: "Mi piace",
  Comments: "Commenti",
  Shares: "Condivisioni",
  Saves: "Salvati",
  Interactions: "Interazioni",
  Engagement: "Coinvolgimento",
  Following: "Seguiti",
  Followers: "Follower",

  // --- Panoramica ---
  "Interaction breakdown": "Ripartizione interazioni",
  "Totals across all videos": "Totali su tutti i video",
  "Sum across": "Somma su",
  "public videos · updated every 5 seconds · “saves” are read from the public pages about once a minute (N/A if TikTok blocks them).":
    "video pubblici · aggiornamento ogni 5 secondi · i “salvati” sono letti dalle pagine pubbliche circa ogni minuto (N/D se TikTok li blocca).",
  "Avg view / video": "Media view / video",
  "Avg like / video": "Media like / video",
  "Avg share rate": "Share rate medio",
  "Public videos": "Video pubblici",
  "Latest videos": "Ultimi video",
  "See all": "Vedi tutti",
  "No public videos found.": "Nessun video pubblico trovato.",
  "Best video": "Miglior video",
  "Top by share rate": "Top per share rate",
  Details: "Dettagli",

  // --- Lista video ---
  "All videos": "Tutti i video",
  "Export the video list as CSV": "Esporta l’elenco video in CSV",
  Page: "Pagina",
  of: "di",
  "← Prev": "← Prec",
  "Next →": "Succ →",

  // --- Dettaglio video ---
  "Video not found.": "Video non trovato.",
  "← All videos": "← Tutti i video",
  "Saves updated.": "Salvati aggiornati.",
  "Scraping failed, try again shortly.": "Scraping non riuscito, riprova tra poco.",
  "Error during scraping": "Errore durante lo scraping",
  "by views": "per visualizzazioni",
  "Published on": "Pubblicato il",
  Duration: "Durata",
  "Open on TikTok": "Apri su TikTok",
  "Close the player": "Chiudi il player",
  "Play the video": "Riproduci il video",
  "Reread this video's saves now from the public page (scraping)":
    "Rileggi ora i 'salvati' di questo video dalla pagina pubblica (scraping)",
  "Refreshing saves…": "Aggiorno salvati…",
  "Refresh saves (scraping)": "Aggiorna salvati (scraping)",
  "Intensity · per 1,000 views": "Intensità · ogni 1.000 visualizzazioni",
  "Available once the video reaches 1,000 views.":
    "Disponibile al raggiungimento di 1.000 visualizzazioni.",
  Missing: "Mancano",
  "views to reach 1,000.": "visualizzazioni.",
  "Compared to profile average": "Confronto con la media del profilo",
  This: "Questo",
  Average: "Media",
  "Current counters updated every 5 seconds. The trend over time is reconstructed from the snapshots the site records (the TikTok API does not expose it per individual video); it populates gradually.":
    "Contatori attuali aggiornati ogni 5 secondi. L’andamento nel tempo è ricostruito dagli snapshot che il sito registra (l’API TikTok non lo espone per singolo video); si popola man mano.",
  "Trend over time": "Andamento nel tempo",
  "Configure the database to record this video's trend over time.":
    "Configura il database per registrare l’andamento nel tempo di questo video.",
  "Collecting data: the curve appears after a few readings (one snapshot every ~5 minutes while the video is active).":
    "Sto raccogliendo i dati: la curva compare dopo qualche rilevazione (uno snapshot ogni ~5 minuti mentre il video è attivo).",
  "Speed · last hour": "Velocità · ultima ora",
  "views in the last hour": "views nell’ultima ora",
  "Current share rate": "Share rate attuale",
  "shares / views": "condivisioni / views",
  "Views over time": "Visualizzazioni nel tempo",
  "Share rate over time": "Share rate nel tempo",

  // --- Crescita ---
  today: "oggi",
  "7 days": "7 giorni",
  "30 days": "30 giorni",
  "90 days": "90 giorni",
  "120 days": "120 giorni",
  "Network error": "Errore di rete",
  "Real trend over time: snapshots are saved in your browser while you use the app.":
    "Andamento reale nel tempo: gli snapshot si salvano nel tuo browser mentre usi l’app.",
  Total: "Totale",
  "Change/hour": "Variazione/ora",
  "Change/day": "Variazione/giorno",
  "Export history as CSV": "Esporta lo storico in CSV",
  "Can’t read history:": "Non riesco a leggere lo storico:",
  "At the pace of the last 7 days (": "Al ritmo degli ultimi 7 giorni (",
  "/day) you’ll reach": "/giorno) raggiungi",
  "followers in about": "follower tra circa",
  "days.": "giorni.",
  "Followers gained": "Follower guadagnati",
  "Follower growth": "Crescita follower",
  publications: "pubblicazioni",
  "Likes over time": "Mi piace nel tempo",
  "Saves over time": "Salvati nel tempo",
  "Collecting data. Statistics are saved in your browser (and on the server) while you use the app, one snapshot per minute: at least two different moments are needed to track growth.":
    "Sto raccogliendo i dati. Le statistiche vengono salvate nel tuo browser (e sul server) mentre usi l’app, una foto al minuto: servono almeno due momenti diversi per tracciare la crescita.",
  "snapshots so far — come back later.": "snapshot finora — torna più tardi.",
  "Leave the dashboard open and come back later.":
    "Lascia aperta la dashboard e torna più tardi.",

  // --- Analisi ---
  "Saves / 1,000": "Salvati / 1.000",
  "Views · last": "Visualizzazioni · ultimi",
  "Interactions · last": "Interazioni · ultimi",
  videos: "video",
  "Average views by publish day": "View medie per giorno di pubblicazione",
  "Average views by time slot": "View medie per fascia oraria",
  "When to post · day × hour heatmap": "Quando pubblicare · heatmap giorno × ora",
  "Average views by duration": "View medie per durata",
  "No videos available.": "Nessun video disponibile.",
  "These charts capture the current state of each video. For the trend over time (daily growth, peaks) see the Growth section.":
    "Questi grafici fotografano lo stato attuale di ogni video. Per l’andamento nel tempo (crescita giornaliera, picchi) vai alla sezione Crescita.",
  "avg views": "view medie",
  Mon: "Lun",
  Tue: "Mar",
  Wed: "Mer",
  Thu: "Gio",
  Fri: "Ven",
  Sat: "Sab",
  Sun: "Dom",
  "Total interactions": "Interazioni totali",
  "Best video (views)": "Miglior video (view)",
  "Views from top 10": "View dai top 10",
  "how much of the views comes from the 10 best videos":
    "quanta parte delle visualizzazioni arriva dai 10 video migliori",
};

// Dizionari per lingua (l'inglese è la fonte: nessun dizionario, fallback alla
// chiave). Lo spagnolo vive in ./es.ts.
const DICTS: Record<Locale, Record<string, string>> = { en: {}, it, es };

/** Traduce `en` nella lingua data (fallback: l'inglese stesso). */
export function translate(locale: Locale, en: string): string {
  return DICTS[locale]?.[en] ?? en;
}
