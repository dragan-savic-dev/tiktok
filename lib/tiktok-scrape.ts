import type { VideoStats } from "./types";

// Il conteggio "salvati" (collectCount) non è esposto dalla Display API
// ufficiale: lo ricaviamo dal JSON incorporato nelle pagine pubbliche dei
// video. Nessun limite sul numero di video, ma per non farsi bloccare da
// TikTok non si scaricano mai tutte le pagine in un colpo: a ogni ciclo
// (~1/min, vedi TTL in collect.ts) si aggiorna solo un piccolo lotto,
// ruotando sui video col dato più vecchio. I valori già letti restano validi
// tra un giro e l'altro, quindi a regime la mappa è sempre completa.

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
  /** Somma sui video correnti; null finché la prima rotazione non è completa. */
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
 * dei "salvati" noti finora. Il totale viene esposto solo quando ogni video
 * corrente ha un valore: una somma parziale sarebbe un numero sbagliato, non
 * un'approssimazione.
 */
export async function getSavedCounts(
  openId: string,
  videos: VideoStats[],
): Promise<SavedCounts> {
  let state = stateByUser.get(openId);
  if (!state) {
    state = new Map();
    stateByUser.set(openId, state);
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
  let complete = true;
  for (const v of videos) {
    const count = state.get(v.id)?.count;
    if (count === undefined) {
      complete = false;
      continue;
    }
    byVideo[v.id] = count;
  }

  return {
    total: complete
      ? Object.values(byVideo).reduce((sum, n) => sum + n, 0)
      : null,
    byVideo: Object.keys(byVideo).length > 0 ? byVideo : null,
  };
}
