import { readSavedStore, setSavedCount, writeSavedStore } from "./saved-store";
import type { VideoStats } from "./types";

// Il conteggio "salvati" (collectCount) non è esposto dalla Display API
// ufficiale: lo ricaviamo dal JSON incorporato nelle pagine pubbliche dei
// video. Lo scraping lo fa SOLO il collettore sul server, ogni 10 min: a ogni
// ciclo si aggiornano TUTTI i video (con share_url), ma in modo cadenzato
// (gruppetti in parallelo con pause) per non farsi bloccare da TikTok. I
// conteggi noti vengono persistiti (lib/saved-store.ts) e la guardia monotòna
// evita regressioni: un video già letto non torna mai a N/D.

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

// Si scaricano TUTTI i video, ma in gruppetti da 4 in parallelo con una pausa
// tra un gruppo e l'altro: il ritmo verso tiktok.com resta basso e sotto le
// soglie anti-bot. Con lo scraping ora solo ogni 10 min, la media di richieste
// è più bassa di prima.
const CONCURRENCY = 4;
const CHUNK_PAUSE_MS = 500;

export interface SavedCounts {
  /** Totale generale: somma dei conteggi dei singoli video noti (null se nessuno). */
  total: number | null;
  /** "Salvati" per singolo video (id -> conteggio); parziale durante la rotazione. */
  byVideo: Record<string, number> | null;
}

interface VideoSavedState {
  /** Ultimo conteggio letto con successo (assente se mai riuscito). */
  count?: number;
  /** Epoch ms dell'ultimo tentativo, anche fallito: guida la rotazione. */
  attemptedAt: number;
}

// Stato per utente, per processo: su hosting serverless riparte a freddo e la
// rotazione ricomincia (il totale torna N/D finché non è di nuovo completa).
const stateByUser = new Map<string, Map<string, VideoSavedState>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Guardia anti-scrape-sporco: i "salvati" totali di un video non calano nel
 * breve periodo. Un valore più basso del precedente è quasi sempre una lettura
 * parziale/errata (il famoso -4922) → si tiene l'ultimo valido. Una lettura
 * fallita (null) conserva anch'essa il precedente.
 */
function reconcileSaved(
  prev: number | undefined,
  fresh: number | null,
): number | undefined {
  if (fresh == null) return prev;
  if (prev === undefined) return fresh;
  return fresh >= prev ? fresh : prev;
}

async function fetchCollectCount(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/"collectCount":\s*"?(\d+)"?/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Aggiorna un lotto di video (quelli col dato più vecchio) e ritorna la mappa
 * dei "salvati" noti finora. Il totale generale è la somma dei conteggi dei
 * singoli video noti (i "count in generale si prendono dai video"): niente più
 * gate sulla completezza, così il dato compare appena c'è ed è sempre
 * coerente con i valori dei singoli video.
 */
/**
 * Stato di rotazione in memoria per l'utente. Al primo accesso (cold start) lo
 * reidrata dai conteggi persistiti (DB o filesystem): così i "salvati" già noti
 * tornano subito disponibili (niente N/D). attemptedAt: 0 li mette in cima alla
 * coda di refresh, così vengono comunque riletti col tempo.
 */
async function getState(openId: string): Promise<Map<string, VideoSavedState>> {
  let state = stateByUser.get(openId);
  if (!state) {
    state = new Map();
    stateByUser.set(openId, state);
    const persisted = await readSavedStore(openId);
    for (const [id, count] of Object.entries(persisted)) {
      state.set(id, { count, attemptedAt: 0 });
    }
  }
  return state;
}

/**
 * Scraping ON-DEMAND dei "salvati" di un singolo video (pulsante manuale nella
 * pagina del video). Aggiorna lo stato in memoria e lo store persistente, così
 * il valore compare subito ed è coerente col prossimo /api/stats. Ritorna il
 * conteggio letto, o l'ultimo noto se la lettura fallisce, o null.
 */
export async function scrapeVideoSaved(
  openId: string,
  video: VideoStats,
): Promise<number | null> {
  if (!video.share_url) return null;
  const state = await getState(openId);
  const fresh = await fetchCollectCount(video.share_url);
  const resolved = reconcileSaved(state.get(video.id)?.count, fresh);
  state.set(video.id, { count: resolved, attemptedAt: Date.now() });
  if (resolved !== undefined) {
    await setSavedCount(openId, video.id, resolved);
    return resolved;
  }
  return null;
}

export async function getSavedCounts(
  openId: string,
  videos: VideoStats[],
): Promise<SavedCounts> {
  const state = await getState(openId);

  // Dimentica i video non più pubblici.
  const ids = new Set(videos.map((v) => v.id));
  for (const id of [...state.keys()]) {
    if (!ids.has(id)) state.delete(id);
  }

  // Tutti i video con share_url: niente più lotto ridotto. Lo scraping gira solo
  // ogni 10 min (lato server), quindi c'è tempo per aggiornarli tutti a ogni giro.
  const batch = videos.filter((v) => v.share_url);

  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    if (i > 0) await sleep(CHUNK_PAUSE_MS);
    const chunk = batch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((v) => fetchCollectCount(v.share_url!)),
    );
    const now = Date.now();
    chunk.forEach((v, j) => {
      // Guardia monotòna: cali = scrape sporco, si tiene l'ultimo valido.
      const count = reconcileSaved(state.get(v.id)?.count, results[j]);
      state.set(v.id, { count, attemptedAt: now });
    });
  }

  const byVideo: Record<string, number> = {};
  for (const v of videos) {
    const count = state.get(v.id)?.count;
    if (count !== undefined) byVideo[v.id] = count;
  }

  // Persiste i conteggi noti così sopravvivono ai riavvii (best-effort).
  void writeSavedStore(openId, byVideo);

  const knownValues = Object.values(byVideo);
  return {
    // Totale generale = somma dei conteggi dei singoli video noti.
    total:
      knownValues.length > 0
        ? knownValues.reduce((sum, n) => sum + n, 0)
        : null,
    byVideo: knownValues.length > 0 ? byVideo : null,
  };
}
