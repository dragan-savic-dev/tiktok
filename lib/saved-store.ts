import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureSchema, hasDb, sql } from "./db";

// Store dei "salvati" per singolo video (collectCount via scraping, non esposto
// dalla Display API). Due backend, come lib/history.ts:
//   - Neon/Postgres (tabella video_saved) quando DATABASE_URL è configurato;
//   - Filesystem (.data/saved) come fallback.
// Serve a NON perdere i conteggi tra un riavvio e l'altro: un video letto almeno
// una volta mostra sempre il suo valore invece di N/D.

const DATA_DIR = path.join(process.cwd(), ".data", "saved");

// Serializza le scritture su filesystem per utente: read-modify-write senza corse.
const writeChains = new Map<string, Promise<unknown>>();

function fileFor(openId: string): string {
  const safe = openId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `${safe}.json`);
}

async function readFromFile(openId: string): Promise<Record<string, number>> {
  try {
    const raw = await readFile(fileFor(openId), "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [id, n] of Object.entries(parsed)) {
      if (typeof n === "number" && Number.isFinite(n)) out[id] = n;
    }
    return out;
  } catch {
    return {};
  }
}

/** Conteggi "salvati" persistiti (id video -> conteggio). Vuoto se assenti. */
export async function readSavedStore(
  openId: string,
): Promise<Record<string, number>> {
  if (hasDb()) {
    try {
      await ensureSchema();
      const rows = (await sql!`
        SELECT video_id, saved FROM video_saved WHERE open_id = ${openId}
      `) as { video_id: string; saved: unknown }[];
      const out: Record<string, number> = {};
      for (const r of rows) out[r.video_id] = Number(r.saved);
      return out;
    } catch {
      return {};
    }
  }
  return readFromFile(openId);
}

/** Salva l'intera mappa dei "salvati" noti. Best-effort. */
export function writeSavedStore(
  openId: string,
  byVideo: Record<string, number>,
): Promise<void> {
  if (hasDb()) {
    return (async () => {
      try {
        await ensureSchema();
        const ids = Object.keys(byVideo);
        if (ids.length === 0) return;
        const saved = ids.map((id) => byVideo[id]);
        await sql!`
          INSERT INTO video_saved (open_id, video_id, saved, updated_at)
          SELECT ${openId}, x.video_id, x.saved, now() FROM UNNEST(
            ${ids}::text[], ${saved}::bigint[]
          ) AS x(video_id, saved)
          ON CONFLICT (open_id, video_id) DO UPDATE SET
            saved = EXCLUDED.saved, updated_at = now()
        `;
        // Dimentica i video non più presenti nella mappa (non più pubblici).
        await sql!`
          DELETE FROM video_saved
          WHERE open_id = ${openId} AND video_id <> ALL(${ids}::text[])
        `;
      } catch {
        // best-effort
      }
    })();
  }

  const prev = writeChains.get(openId) ?? Promise.resolve();
  const next = prev
    .then(async () => {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(fileFor(openId), JSON.stringify(byVideo), "utf8");
    })
    .catch(() => {});
  writeChains.set(openId, next);
  return next;
}
