import { compactSnapshots, SNAPSHOT_INTERVAL_MS } from "./snapshots";
import type { HistorySnapshot, StatsResponse } from "./types";

// Storico nel browser (localStorage): su hosting serverless il filesystem del
// server è effimero, quindi ogni client accumula i propri snapshot — una foto
// al minuto mentre l'app è aperta, con lo stesso downsampling dello storico
// server. La pagina Crescita unisce le due fonti. Solo lato client.

const KEY = "tiktok-live-stats:history";

// Fast-path: evita di rileggere/parsare il localStorage negli 11/12 poll al
// minuto in cui non c'è nulla da salvare.
let lastRecordedAt = 0;

export function readLocalSnapshots(): HistorySnapshot[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as HistorySnapshot[]) : [];
  } catch {
    // localStorage non disponibile o contenuto corrotto.
    return [];
  }
}

/** Registra uno snapshot dai dati live, al più una volta al minuto. */
export function recordLocalSnapshot(stats: StatsResponse): void {
  const t = stats.fetchedAt;
  if (t - lastRecordedAt < SNAPSHOT_INTERVAL_MS) return;
  lastRecordedAt = t;

  try {
    const snapshots = readLocalSnapshots();
    const lastT = snapshots.at(-1)?.t ?? 0;
    if (t - lastT < SNAPSHOT_INTERVAL_MS) return;

    snapshots.push({
      t,
      followers: stats.user.follower_count ?? 0,
      following: stats.user.following_count ?? 0,
      likes: stats.user.likes_count ?? 0,
      views: stats.totals.views,
      comments: stats.totals.comments,
      shares: stats.totals.shares,
      saved: stats.saved,
      videos: stats.totals.videosCounted,
    });
    localStorage.setItem(KEY, JSON.stringify(compactSnapshots(snapshots, t)));
  } catch {
    // Quota piena o modalità privata: lo storico locale è best-effort.
  }
}
