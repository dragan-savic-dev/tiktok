import type { VideoStats } from "./types";

// Il conteggio "salvati" (collectCount) non è esposto dalla Display API
// ufficiale: lo ricaviamo dal JSON incorporato nelle pagine pubbliche dei
// video. È per natura fragile (TikTok può cambiare il markup o bloccare gli
// IP dei datacenter): in caso di fallimento si ritorna l'ultimo valore noto
// per quell'utente, o null se non ce n'è mai stato uno.

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

const CONCURRENCY = 4;

// Oltre questa soglia lo scraping costerebbe troppe richieste per ciclo:
// meglio nessun dato che farsi bloccare l'IP da TikTok.
const MAX_SCRAPE_VIDEOS = 30;

export interface SavedCounts {
  /** Somma dei "salvati" su tutti i video; null se mai riuscito. */
  total: number | null;
  /** "Salvati" per singolo video (id -> conteggio); null se non disponibile. */
  byVideo: Record<string, number> | null;
}

const lastKnownSaved = new Map<string, SavedCounts>();

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
 * Legge i "salvati" di ogni video e la loro somma. Se anche una sola pagina
 * non è leggibile ritorna l'ultimo insieme noto (un dato parziale sarebbe un
 * numero sbagliato, non un'approssimazione).
 */
export async function getSavedCounts(
  openId: string,
  videos: VideoStats[],
): Promise<SavedCounts> {
  const fallback = () =>
    lastKnownSaved.get(openId) ?? { total: null, byVideo: null };

  if (videos.length > MAX_SCRAPE_VIDEOS) return fallback();

  const counts: (number | null)[] = [];
  for (let i = 0; i < videos.length; i += CONCURRENCY) {
    const chunk = videos.slice(i, i + CONCURRENCY);
    counts.push(
      ...(await Promise.all(
        chunk.map((video) =>
          video.share_url ? fetchCollectCount(video.share_url) : Promise.resolve(null),
        ),
      )),
    );
  }

  if (counts.some((count) => count === null)) return fallback();

  const byVideo: Record<string, number> = {};
  videos.forEach((video, i) => {
    byVideo[video.id] = counts[i] as number;
  });
  const total = counts.reduce<number>((sum, count) => sum + (count as number), 0);
  const result: SavedCounts = { total, byVideo };
  lastKnownSaved.set(openId, result);
  return result;
}
