import { getOrFetch } from "./cache";
import { recordSnapshot } from "./history";
import { aggregateStats, getAllVideoStats, getUserInfo } from "./tiktok";
import { getSavedCounts } from "./tiktok-scrape";
import type { StatsResponse } from "./types";

// TTL sotto i 5s del polling, così ogni ciclo del client trova dati freschi
// ma più tab aperte (e il job in background) condividono la stessa chiamata.
const USER_TTL_MS = 4500;

// I "salvati" arrivano via scraping (una pagina per video): cadenza più lenta
// per non farsi bloccare da TikTok.
const SAVED_TTL_MS = 60_000;

// L'aggregato costa ceil(video_count/20) richieste a /v2/video/list/: con tanti
// video si allunga il TTL per restare lontani dal limite di 600 req/min.
function videoTtlMs(videoCount: number): number {
  const pages = Math.max(1, Math.ceil(videoCount / 20));
  if (pages <= 3) return 4500;
  if (pages <= 10) return 15_000;
  return 30_000;
}

/**
 * Scarica (via cache condivisa) le statistiche complete e ne registra uno
 * snapshot nello storico (throttlato a 1/min). Usata sia da /api/stats sia dal
 * job in background, così condividono cache e logica.
 */
export async function collectStats(
  openId: string,
  accessToken: string,
): Promise<StatsResponse> {
  const user = await getOrFetch(`user:${openId}`, USER_TTL_MS, () =>
    getUserInfo(accessToken),
  );
  const videos = await getOrFetch(
    `videos:${openId}`,
    videoTtlMs(user.video_count ?? 0),
    () => getAllVideoStats(accessToken),
  );
  const totals = aggregateStats(videos);
  const savedCounts = await getOrFetch(`saved:${openId}`, SAVED_TTL_MS, () =>
    getSavedCounts(openId, videos),
  );

  // Arricchisce ogni video col proprio conteggio "salvati" su una copia: la
  // lista in cache (TTL diverso) non va mutata.
  const videosWithSaved = savedCounts.byVideo
    ? videos.map((v) => ({ ...v, saved_count: savedCounts.byVideo?.[v.id] ?? null }))
    : videos;

  const payload: StatsResponse = {
    user,
    totals,
    videos: videosWithSaved,
    saved: savedCounts.total,
    fetchedAt: Date.now(),
  };

  // Alimenta lo storico (best-effort: non deve mai rompere la risposta).
  try {
    await recordSnapshot(openId, {
      t: payload.fetchedAt,
      followers: user.follower_count ?? 0,
      following: user.following_count ?? 0,
      likes: user.likes_count ?? 0,
      views: totals.views,
      comments: totals.comments,
      shares: totals.shares,
      saved: savedCounts.total,
      videos: totals.videosCounted,
    });
  } catch {
    // persistenza best-effort
  }

  return payload;
}
