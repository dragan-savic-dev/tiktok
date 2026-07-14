import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  DailyPoint,
  HistoryDelta,
  HistoryResponse,
  HistorySnapshot,
} from "./types";

// Store storico su filesystem: un file JSON per utente (open_id) con l'elenco
// degli snapshot. È volutamente senza database — coerente con l'app, che non
// dipende da servizi esterni. Gli snapshot si accumulano mentre l'app è aperta
// (una foto al minuto), alimentando i grafici di crescita.

const DATA_DIR = path.join(process.cwd(), ".data", "history");

const DAY_MS = 24 * 60 * 60 * 1000;
// Cadenza minima tra due snapshot dello stesso utente.
const SNAPSHOT_INTERVAL_MS = 60_000;
// Oltre questa età gli snapshot vengono potati; il tetto sul numero è una
// rete di sicurezza contro file fuori scala.
const RETENTION_DAYS = 120;
const MAX_SNAPSHOTS = 20_000;

// Fast-path in memoria: evita l'I/O su disco negli 11/12 poll al minuto in cui
// non c'è nulla da salvare.
const lastRecordedAt = new Map<string, number>();
// Serializza le scritture per utente: read-modify-write senza corse.
const writeChains = new Map<string, Promise<unknown>>();

function fileFor(openId: string): string {
  // open_id è già alfanumerico, ma sanifichiamo per non uscire dalla cartella.
  const safe = openId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `${safe}.json`);
}

async function readSnapshots(openId: string): Promise<HistorySnapshot[]> {
  try {
    const raw = await readFile(fileFor(openId), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistorySnapshot[]) : [];
  } catch {
    // File assente o illeggibile: si riparte da storico vuoto.
    return [];
  }
}

function enqueueWrite(openId: string, task: () => Promise<void>): Promise<void> {
  const prev = writeChains.get(openId) ?? Promise.resolve();
  const next = prev.then(task).catch(() => {});
  writeChains.set(openId, next);
  return next;
}

/**
 * Registra uno snapshot, al più una volta al minuto per utente. È best-effort:
 * qualunque errore di I/O viene ingoiato e non deve mai rompere /api/stats.
 */
export async function recordSnapshot(
  openId: string,
  snapshot: HistorySnapshot,
): Promise<void> {
  const now = snapshot.t;
  const last = lastRecordedAt.get(openId) ?? 0;
  if (now - last < SNAPSHOT_INTERVAL_MS) return;
  // Prenota subito lo slot così due richieste concorrenti non scrivono doppio.
  lastRecordedAt.set(openId, now);

  await enqueueWrite(openId, async () => {
    const snapshots = await readSnapshots(openId);
    const lastT = snapshots.at(-1)?.t ?? 0;
    // Dedup cross-processo/riavvio: la mappa in memoria parte vuota a freddo.
    if (now - lastT < SNAPSHOT_INTERVAL_MS) return;

    snapshots.push(snapshot);

    const cutoff = now - RETENTION_DAYS * DAY_MS;
    let pruned = snapshots.filter((s) => s.t >= cutoff);
    if (pruned.length > MAX_SNAPSHOTS) {
      pruned = pruned.slice(pruned.length - MAX_SNAPSHOTS);
    }

    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(fileFor(openId), JSON.stringify(pruned), "utf8");
  });
}

/** Chiave giorno YYYY-MM-DD nel fuso del server (per i bucket giornalieri). */
function dayKey(t: number): string {
  return new Date(t).toLocaleDateString("sv-SE"); // sv-SE => 2026-07-13
}

/** Chiave ora "YYYY-MM-DD HH" nel fuso del server (bucket orari). */
function hourKey(t: number): string {
  return `${dayKey(t)} ${String(new Date(t).getHours()).padStart(2, "0")}`;
}

export type HistoryGranularity = "day" | "hour";

/** Ultimo snapshot di ogni bucket (giorno oppure ora), in ordine cronologico. */
function toSeries(
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

function computeDelta(
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

/** Costruisce la risposta storica per l'utente sull'intervallo richiesto. */
export async function getHistory(
  openId: string,
  days: number,
  granularity: HistoryGranularity = "day",
): Promise<HistoryResponse> {
  const all = await readSnapshots(openId);
  const now = Date.now();
  const cutoff = now - days * DAY_MS;
  const windowed = all.filter((s) => s.t >= cutoff);

  return {
    daily: toSeries(windowed, granularity),
    deltas: {
      followers: computeDelta(all, (s) => s.followers, now),
      views: computeDelta(all, (s) => s.views, now),
      likes: computeDelta(all, (s) => s.likes, now),
      comments: computeDelta(all, (s) => s.comments, now),
      shares: computeDelta(all, (s) => s.shares, now),
      saved: computeDelta(all, (s) => s.saved, now),
    },
    firstAt: all[0]?.t ?? null,
    count: all.length,
  };
}
