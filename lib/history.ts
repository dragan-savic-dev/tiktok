import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureSchema, hasDb, sql } from "./db";
import {
  compactSnapshots,
  computeDelta,
  DAY_MS,
  RETENTION_DAYS,
  SNAPSHOT_INTERVAL_MS,
  toSeries,
  type HistoryGranularity,
} from "./snapshots";
import type { HistoryResponse, HistorySnapshot } from "./types";

// Store storico degli snapshot account (serie temporale delle metriche). Due
// backend intercambiabili:
//   - Neon/Postgres quando DATABASE_URL è configurato (robusto, per-utente,
//     sopravvive ai riavvii serverless). È il backend che vogliamo a regime.
//   - Filesystem (.data/history) come fallback quando il DB non c'è ancora,
//     così l'app resta funzionante durante la migrazione.
// Lato client gli snapshot venivano accumulati in localStorage: il bottone di
// sync li importa qui (vedi importSnapshots) e poi il client smette di salvarli
// perché ci pensa il server ogni minuto.

const DATA_DIR = path.join(process.cwd(), ".data", "history");

// Fast-path in memoria: evita I/O (disco o rete) negli 11/12 poll al minuto in
// cui non c'è nulla da salvare.
const lastRecordedAt = new Map<string, number>();
// Serializza le scritture su filesystem per utente: read-modify-write sicuro.
const writeChains = new Map<string, Promise<unknown>>();
// Prune del DB al più una volta all'ora per utente (evita DELETE a ogni scrittura).
const lastPrunedAt = new Map<string, number>();
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

function fileFor(openId: string): string {
  const safe = openId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `${safe}.json`);
}

async function readSnapshots(openId: string): Promise<HistorySnapshot[]> {
  try {
    const raw = await readFile(fileFor(openId), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistorySnapshot[]) : [];
  } catch {
    return [];
  }
}

function enqueueWrite(openId: string, task: () => Promise<void>): Promise<void> {
  const prev = writeChains.get(openId) ?? Promise.resolve();
  const next = prev.then(task).catch(() => {});
  writeChains.set(openId, next);
  return next;
}

// --- Backend Neon ------------------------------------------------------------

/** Riga DB -> HistorySnapshot (i bigint tornano come stringa: li normalizziamo). */
function rowToSnapshot(r: Record<string, unknown>): HistorySnapshot {
  const num = (v: unknown): number => Number(v ?? 0);
  return {
    t: num(r.t),
    followers: num(r.followers),
    following: num(r.following),
    likes: num(r.likes),
    views: num(r.views),
    comments: num(r.comments),
    shares: num(r.shares),
    saved: r.saved === null || r.saved === undefined ? null : Number(r.saved),
    videos: num(r.videos),
  };
}

async function insertSnapshotDb(
  openId: string,
  s: HistorySnapshot,
): Promise<void> {
  await ensureSchema();
  await sql!`
    INSERT INTO account_snapshots
      (open_id, t, followers, following, likes, views, comments, shares, saved, videos)
    VALUES
      (${openId}, ${s.t}, ${s.followers}, ${s.following}, ${s.likes}, ${s.views},
       ${s.comments}, ${s.shares}, ${s.saved}, ${s.videos})
    ON CONFLICT (open_id, t) DO NOTHING
  `;
  // Prune retention, saltuariamente.
  const now = s.t;
  if (now - (lastPrunedAt.get(openId) ?? 0) >= PRUNE_INTERVAL_MS) {
    lastPrunedAt.set(openId, now);
    const cutoff = now - RETENTION_DAYS * DAY_MS;
    await sql!`DELETE FROM account_snapshots WHERE open_id = ${openId} AND t < ${cutoff}`;
  }
}

async function readSnapshotsDb(
  openId: string,
  sinceMs: number,
): Promise<HistorySnapshot[]> {
  await ensureSchema();
  const rows = (await sql!`
    SELECT t, followers, following, likes, views, comments, shares, saved, videos
    FROM account_snapshots
    WHERE open_id = ${openId} AND t >= ${sinceMs}
    ORDER BY t ASC
  `) as Record<string, unknown>[];
  return rows.map(rowToSnapshot);
}

// --- API pubblica ------------------------------------------------------------

/**
 * Registra uno snapshot, al più una volta al minuto per utente. Best-effort:
 * qualunque errore (disco o DB) viene ingoiato e non deve mai rompere le API.
 */
export async function recordSnapshot(
  openId: string,
  snapshot: HistorySnapshot,
): Promise<void> {
  const now = snapshot.t;
  const last = lastRecordedAt.get(openId) ?? 0;
  if (now - last < SNAPSHOT_INTERVAL_MS) return;
  lastRecordedAt.set(openId, now);

  if (hasDb()) {
    try {
      await insertSnapshotDb(openId, snapshot);
    } catch {
      // best-effort
    }
    return;
  }

  // Fallback filesystem.
  await enqueueWrite(openId, async () => {
    const snapshots = await readSnapshots(openId);
    const lastT = snapshots.at(-1)?.t ?? 0;
    if (now - lastT < SNAPSHOT_INTERVAL_MS) return;
    snapshots.push(snapshot);
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(
      fileFor(openId),
      JSON.stringify(compactSnapshots(snapshots, now)),
      "utf8",
    );
  });
}

/**
 * Importa un lotto di snapshot (es. quelli accumulati nel localStorage del
 * telefono) nello store DB. Idempotente: ON CONFLICT DO NOTHING sul timestamp.
 * Ritorna quanti ne ha inseriti davvero. No-op senza DB.
 */
export async function importSnapshots(
  openId: string,
  snapshots: HistorySnapshot[],
): Promise<number> {
  if (!hasDb() || snapshots.length === 0) return 0;
  await ensureSchema();

  const clean = snapshots.filter(
    (s) => s && typeof s.t === "number" && Number.isFinite(s.t),
  );
  if (clean.length === 0) return 0;

  const col = <T>(pick: (s: HistorySnapshot) => T): T[] => clean.map(pick);
  const rows = (await sql!`
    INSERT INTO account_snapshots
      (open_id, t, followers, following, likes, views, comments, shares, saved, videos)
    SELECT ${openId}, x.* FROM UNNEST(
      ${col((s) => s.t)}::bigint[],
      ${col((s) => s.followers ?? 0)}::int[],
      ${col((s) => s.following ?? 0)}::int[],
      ${col((s) => s.likes ?? 0)}::bigint[],
      ${col((s) => s.views ?? 0)}::bigint[],
      ${col((s) => s.comments ?? 0)}::bigint[],
      ${col((s) => s.shares ?? 0)}::bigint[],
      ${col((s) => s.saved)}::bigint[],
      ${col((s) => s.videos ?? 0)}::int[]
    ) AS x(t, followers, following, likes, views, comments, shares, saved, videos)
    ON CONFLICT (open_id, t) DO NOTHING
    RETURNING t
  `) as Record<string, unknown>[];
  return rows.length;
}

/** Costruisce la risposta storica per l'utente sull'intervallo richiesto. */
export async function getHistory(
  openId: string,
  days: number,
  granularity: HistoryGranularity = "day",
): Promise<HistoryResponse> {
  const now = Date.now();
  const seriesCut = now - days * DAY_MS;
  // I delta "oggi"/"7 giorni" servono anche con finestre corte: leggi >= 8gg.
  const readCut = now - Math.max(days, 8) * DAY_MS;

  const all = hasDb()
    ? await readSnapshotsDb(openId, readCut)
    : (await readSnapshots(openId)).filter((s) => s.t >= readCut);

  const windowed = all.filter((s) => s.t >= seriesCut);

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
    dbEnabled: hasDb(),
  };
}
