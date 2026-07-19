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

/** Svuota lo storico locale (dopo un sync riuscito verso il DB). */
export function clearLocalSnapshots(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}

/**
 * Carica gli snapshot accumulati in localStorage nello storico DB del server
 * ("sync dal telefono"). Ritorna quanti ne ha inseriti. Idempotente lato
 * server. Non svuota il locale: lo decide il chiamante dopo il successo.
 */
export async function syncLocalSnapshots(): Promise<{
  imported: number;
  received: number;
}> {
  const snapshots = readLocalSnapshots();
  if (snapshots.length === 0) return { imported: 0, received: 0 };
  const res = await fetch("/api/history/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshots }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      typeof body?.message === "string" ? body.message : `HTTP ${res.status}`,
    );
  }
  const body = await res.json();
  return {
    imported: body.imported ?? 0,
    received: body.received ?? snapshots.length,
  };
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
