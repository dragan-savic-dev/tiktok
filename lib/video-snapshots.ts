import { ensureSchema, hasDb, sql } from "./db";
import { DAY_MS, RETENTION_DAYS } from "./snapshots";
import type { VideoStats } from "./types";

// Serie temporale PER SINGOLO VIDEO: è il dato che l'API TikTok non espone e
// che va accumulato nel tempo. Abilita la curva dello share rate, la velocità
// (views/ora), il rilevamento ondate e le proiezioni della roadmap.
//
// Solo backend DB (Neon): senza DATABASE_URL non si raccoglie (niente fallback
// su filesystem — sarebbe troppo voluminoso e poco utile).
//
// Per tenere il volume sotto controllo:
//   - cadenza più larga dell'account (ogni 5 min invece di 1 min);
//   - si campionano solo i video "attivi" (pubblicati di recente o tra i più
//     visti), non l'intero catalogo;
//   - prune a retention come per lo storico account.

const VIDEO_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const ACTIVE_DAYS = 30;
const TOP_BY_VIEWS = 100;
const MAX_ACTIVE = 200;

const lastRecordedAt = new Map<string, number>();
const lastPrunedAt = new Map<string, number>();

/** Video "attivi": pubblicati negli ultimi ACTIVE_DAYS giorni + top per views. */
function selectActive(videos: VideoStats[], now: number): VideoStats[] {
  const cutoffSec = (now - ACTIVE_DAYS * DAY_MS) / 1000;
  const set = new Map<string, VideoStats>();
  for (const v of videos) {
    if ((v.create_time ?? 0) >= cutoffSec) set.set(v.id, v);
  }
  const topByViews = [...videos]
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, TOP_BY_VIEWS);
  for (const v of topByViews) set.set(v.id, v);
  return [...set.values()].slice(0, MAX_ACTIVE);
}

async function upsertCatalog(openId: string, videos: VideoStats[]): Promise<void> {
  if (videos.length === 0) return;
  const ids = videos.map((v) => v.id);
  const createTime = videos.map((v) => v.create_time ?? null);
  const duration = videos.map((v) => v.duration ?? null);
  const title = videos.map((v) => v.title ?? v.video_description ?? null);
  await sql!`
    INSERT INTO videos (open_id, video_id, create_time, duration, title)
    SELECT ${openId}, x.* FROM UNNEST(
      ${ids}::text[], ${createTime}::bigint[], ${duration}::int[], ${title}::text[]
    ) AS x(video_id, create_time, duration, title)
    ON CONFLICT (open_id, video_id) DO UPDATE SET
      create_time = COALESCE(EXCLUDED.create_time, videos.create_time),
      duration = COALESCE(EXCLUDED.duration, videos.duration),
      title = COALESCE(EXCLUDED.title, videos.title)
  `;
}

/**
 * Registra uno snapshot per i video attivi (throttlato a 1/5min per utente).
 * Best-effort: nessun errore deve rompere la raccolta. No-op senza DB.
 */
export async function recordVideoSnapshots(
  openId: string,
  videos: VideoStats[],
): Promise<void> {
  if (!hasDb() || videos.length === 0) return;
  const now = Date.now();
  if (now - (lastRecordedAt.get(openId) ?? 0) < VIDEO_SNAPSHOT_INTERVAL_MS) return;
  lastRecordedAt.set(openId, now);

  try {
    await ensureSchema();
    await upsertCatalog(openId, videos);

    const active = selectActive(videos, now);
    if (active.length > 0) {
      const ids = active.map((v) => v.id);
      const ts = active.map(() => now);
      const views = active.map((v) => v.view_count ?? 0);
      const likes = active.map((v) => v.like_count ?? 0);
      const comments = active.map((v) => v.comment_count ?? 0);
      const shares = active.map((v) => v.share_count ?? 0);
      const saved = active.map((v) => v.saved_count ?? null);
      await sql!`
        INSERT INTO video_snapshots
          (open_id, video_id, t, views, likes, comments, shares, saved)
        SELECT ${openId}, x.* FROM UNNEST(
          ${ids}::text[], ${ts}::bigint[], ${views}::bigint[], ${likes}::bigint[],
          ${comments}::bigint[], ${shares}::bigint[], ${saved}::bigint[]
        ) AS x(video_id, t, views, likes, comments, shares, saved)
        ON CONFLICT (open_id, video_id, t) DO NOTHING
      `;
    }

    if (now - (lastPrunedAt.get(openId) ?? 0) >= PRUNE_INTERVAL_MS) {
      lastPrunedAt.set(openId, now);
      const cutoff = now - RETENTION_DAYS * DAY_MS;
      await sql!`DELETE FROM video_snapshots WHERE open_id = ${openId} AND t < ${cutoff}`;
    }
  } catch {
    // best-effort
  }
}
