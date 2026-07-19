import { getOrFetch } from "./cache";
import { hasDb, upsertUser } from "./db";
import { recordSnapshot } from "./history";
import { readSavedStore } from "./saved-store";
import { aggregateStats, getAllVideoStats, getUserInfo } from "./tiktok";
import { getSavedCounts, type SavedCounts } from "./tiktok-scrape";
import { recordVideoSnapshots } from "./video-snapshots";
import type { StatsResponse } from "./types";

// TTL sotto i 5s del polling, così ogni ciclo del client trova dati freschi
// ma più tab aperte (e il job in background) condividono la stessa chiamata.
const USER_TTL_MS = 4500;

// I "salvati" arrivano via scraping a rotazione (un lotto di pagine per
// ciclo, vedi tiktok-scrape.ts): cadenza lenta per non farsi bloccare.
const SAVED_TTL_MS = 60_000;

// L'aggregato costa ceil(video_count/20) richieste a /v2/video/list/: con tanti
// video si allunga il TTL per restare lontani dal limite di 600 req/min.
function videoTtlMs(videoCount: number): number {
  const pages = Math.max(1, Math.ceil(videoCount / 20));
  if (pages <= 3) return 4500;
  if (pages <= 10) return 15_000;
  return 30_000;
}

export interface CollectOptions {
  /**
   * true: aggiorna i "salvati" via scraping delle pagine pubbliche (SOLO server).
   * false: li legge dallo store già popolato dal collettore (per il client).
   */
  scrape?: boolean;
  /**
   * true: storicizza (snapshot account + per-video, upsert utente) — lavoro del
   * collettore. false: solo lettura per il display (il client non scrive nulla).
   */
  record?: boolean;
}

/** Ricostruisce i conteggi "salvati" dallo store, senza scraping (per il client). */
async function savedFromStore(openId: string): Promise<SavedCounts> {
  const map = await readSavedStore(openId);
  const values = Object.values(map);
  return {
    total: values.length > 0 ? values.reduce((sum, n) => sum + n, 0) : null,
    byVideo: values.length > 0 ? map : null,
  };
}

/**
 * Scarica le statistiche complete (via cache condivisa) e — se richiesto — le
 * storicizza. Il collettore la usa con scrape+record (fa tutto); il client
 * (/api/stats) con scrape:false e record:false, quindi mostra solo i dati live
 * dell'API TikTok + i "salvati" già raccolti dal server, senza scrapare né
 * scrivere.
 */
export async function collectStats(
  openId: string,
  accessToken: string,
  { scrape = true, record = true }: CollectOptions = {},
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

  // Scraping dei "salvati" solo lato server: il client li legge dallo store.
  const savedCounts = scrape
    ? await getOrFetch(`saved:${openId}`, SAVED_TTL_MS, () =>
        getSavedCounts(openId, videos),
      )
    : await savedFromStore(openId);

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
    db: hasDb(),
  };

  // Storicizzazione: solo quando richiesto (collettore). Il client non scrive.
  if (record) {
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
    void upsertUser(openId, user);
    void recordVideoSnapshots(openId, videosWithSaved);
  }

  return payload;
}
