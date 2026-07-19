import { readSavedStore, writeSavedStore } from "./saved-store";
import type { VideoStats } from "./types";

// Il conteggio "salvati" (collectCount) non è esposto dalla Display API
// ufficiale: lo ricaviamo dal JSON incorporato nelle pagine pubbliche dei
// video. Nessun limite sul numero di video, ma per non farsi bloccare da
// TikTok non si scaricano mai tutte le pagine in un colpo: a ogni ciclo
// (~1/min, vedi TTL in collect.ts) si aggiorna solo un piccolo lotto,
// ruotando sui video col dato più vecchio. I valori già letti restano validi
// tra un giro e l'altro, quindi a regime la mappa è sempre completa. I
// conteggi noti vengono anche persistiti su disco (lib/saved-store.ts): dopo
// un riavvio tornano subito disponibili, così un video già letto non regredisce
// mai a N/D.

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

// Pagine per ciclo e parallelismo: ~12 richieste al minuto verso tiktok.com,
// in gruppetti da 4 con una pausa tra l'uno e l'altro — ben sotto le soglie
// che fanno scattare i blocchi anti-bot.
const BATCH_SIZE = 12;
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
export async function getSavedCounts(
  openId: string,
  videos: VideoStats[],
): Promise<SavedCounts> {
  let state = stateByUser.get(openId);
  if (!state) {
    state = new Map();
    stateByUser.set(openId, state);
    // Reidrata dai conteggi persistiti su disco: dopo un cold start i "salvati"
    // già noti tornano subito disponibili (niente N/D). attemptedAt: 0 li mette
    // in cima alla coda di refresh, così vengono comunque riletti col tempo.
    const persisted = await readSavedStore(openId);
    for (const [id, count] of Object.entries(persisted)) {
      state.set(id, { count, attemptedAt: 0 });
    }
  }

  // Dimentica i video non più pubblici.
  const ids = new Set(videos.map((v) => v.id));
  for (const id of [...state.keys()]) {
    if (!ids.has(id)) state.delete(id);
  }

  // Lotto di questo giro: prima i video mai letti, poi quelli più "vecchi".
  const batch = videos
    .filter((v) => v.share_url)
    .sort(
      (a, b) =>
        (state.get(a.id)?.attemptedAt ?? 0) - (state.get(b.id)?.attemptedAt ?? 0),
    )
    .slice(0, BATCH_SIZE);

  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    if (i > 0) await sleep(CHUNK_PAUSE_MS);
    const chunk = batch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((v) => fetchCollectCount(v.share_url!)),
    );
    const now = Date.now();
    chunk.forEach((v, j) => {
      // In caso di pagina illeggibile si conserva il valore precedente.
      const count = results[j] ?? state.get(v.id)?.count;
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
