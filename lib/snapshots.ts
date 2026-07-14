import type { DailyPoint, HistoryDelta, HistorySnapshot } from "./types";

// Funzioni pure condivise tra lo storico lato server (lib/history.ts, su
// filesystem) e quello locale nel browser (lib/local-history.ts, su
// localStorage): stesso downsampling, stesse serie e stessi delta ovunque.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
/** Cadenza minima tra due snapshot dello stesso utente. */
export const SNAPSHOT_INTERVAL_MS = 60_000;
/** Retention e tetto assoluto come rete di sicurezza. */
export const RETENTION_DAYS = 120;
export const MAX_SNAPSHOTS = 20_000;

export type HistoryGranularity = "day" | "hour";

/** Chiave giorno YYYY-MM-DD nel fuso locale (per i bucket giornalieri). */
export function dayKey(t: number): string {
  return new Date(t).toLocaleDateString("sv-SE"); // sv-SE => 2026-07-13
}

/** Chiave ora "YYYY-MM-DD HH" nel fuso locale (bucket orari). */
export function hourKey(t: number): string {
  return `${dayKey(t)} ${String(new Date(t).getHours()).padStart(2, "0")}`;
}

/**
 * Downsampling con retention: minuto per le ultime 48 ore, orario fino a 14
 * giorni, giornaliero fino a RETENTION_DAYS. Tiene lo storico piccolo senza
 * perdere i grafici: la vista oraria copre 7 giorni, quella giornaliera il
 * resto. Richiede snapshot in ordine cronologico.
 */
export function compactSnapshots(
  snapshots: HistorySnapshot[],
  now: number,
): HistorySnapshot[] {
  const minuteCut = now - 2 * DAY_MS;
  const hourCut = now - 14 * DAY_MS;
  const cutoff = now - RETENTION_DAYS * DAY_MS;

  const byBucket = new Map<string, HistorySnapshot>();
  for (const s of snapshots) {
    if (s.t < cutoff) continue;
    const key =
      s.t >= minuteCut
        ? `m${Math.floor(s.t / SNAPSHOT_INTERVAL_MS)}`
        : s.t >= hourCut
          ? `h${Math.floor(s.t / HOUR_MS)}`
          : `d${dayKey(s.t)}`;
    byBucket.set(key, s); // gli snapshot sono ordinati: vince l'ultimo del bucket
  }

  let pruned = [...byBucket.values()].sort((a, b) => a.t - b.t);
  if (pruned.length > MAX_SNAPSHOTS) {
    pruned = pruned.slice(pruned.length - MAX_SNAPSHOTS);
  }
  return pruned;
}

/** Unione di più fonti di snapshot: ordina e deduplica per bucket. */
export function mergeSnapshots(
  a: HistorySnapshot[],
  b: HistorySnapshot[],
  now: number,
): HistorySnapshot[] {
  return compactSnapshots(
    [...a, ...b].sort((x, y) => x.t - y.t),
    now,
  );
}

/** Ultimo snapshot di ogni bucket (giorno oppure ora), in ordine cronologico. */
export function toSeries(
  snapshots: HistorySnapshot[],
  granularity: HistoryGranularity,
): DailyPoint[] {
  const keyOf = granularity === "hour" ? hourKey : dayKey;
  const byBucket = new Map<string, HistorySnapshot>();
  for (const s of snapshots) {
    byBucket.set(keyOf(s.t), s); // gli snapshot sono ordinati: vince l'ultimo
  }
  return [...byBucket.entries()]
    .map(([day, s]) => ({ ...s, day }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** Ultimo valore non-null con t <= target, oppure null se non esiste. */
function valueBefore(
  snapshots: HistorySnapshot[],
  target: number,
  pick: (s: HistorySnapshot) => number | null,
): number | null {
  let result: number | null = null;
  for (const s of snapshots) {
    if (s.t > target) break;
    const v = pick(s);
    if (v !== null) result = v;
  }
  return result;
}

export function computeDelta(
  snapshots: HistorySnapshot[],
  pick: (s: HistorySnapshot) => number | null,
  now: number,
): HistoryDelta {
  // Ignora gli snapshot senza valore (es. "salvati" non disponibili).
  const valued = snapshots.filter((s) => pick(s) !== null);
  if (valued.length === 0) return { today: null, week: null };
  const latest = pick(valued[valued.length - 1]) as number;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  // Valore "a mezzanotte": ultimo di ieri, o il primo di oggi se l'app è nuova.
  let todayBase = valueBefore(valued, startOfToday.getTime(), pick);
  if (todayBase === null) todayBase = pick(valued[0]);

  const weekBase = valueBefore(valued, now - 7 * DAY_MS, pick);

  return {
    today: todayBase === null ? null : latest - todayBase,
    week: weekBase === null ? null : latest - weekBase,
  };
}
