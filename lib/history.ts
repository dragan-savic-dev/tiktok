import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  compactSnapshots,
  computeDelta,
  DAY_MS,
  SNAPSHOT_INTERVAL_MS,
  toSeries,
  type HistoryGranularity,
} from "./snapshots";
import type { HistoryResponse, HistorySnapshot } from "./types";

// Store storico su filesystem: un file JSON per utente (open_id) con l'elenco
// degli snapshot. È volutamente senza database — coerente con l'app, che non
// dipende da servizi esterni. Gli snapshot si accumulano mentre l'app è aperta
// (una foto al minuto), alimentando i grafici di crescita. Nota: su hosting
// serverless (es. Vercel) il filesystem è effimero, quindi questo storico è
// solo una delle fonti — il client ne tiene una copia in localStorage
// (lib/local-history.ts) e la pagina Crescita unisce le due.

const DATA_DIR = path.join(process.cwd(), ".data", "history");

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
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(
      fileFor(openId),
      JSON.stringify(compactSnapshots(snapshots, now)),
      "utf8",
    );
  });
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
