import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Store su filesystem dei "salvati" per singolo video (collectCount via
// scraping, non esposto dalla Display API). Mirror di lib/history.ts: un file
// JSON per utente in .data/saved. Serve a NON perdere i conteggi tra un
// riavvio e l'altro: un video letto almeno una volta mostra sempre il suo
// valore invece di N/D, anche dopo un cold start serverless.

const DATA_DIR = path.join(process.cwd(), ".data", "saved");

// Serializza le scritture per utente: read-modify-write senza corse.
const writeChains = new Map<string, Promise<unknown>>();

function fileFor(openId: string): string {
  // open_id è già alfanumerico, ma sanifichiamo per non uscire dalla cartella.
  const safe = openId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `${safe}.json`);
}

/** Conteggi "salvati" persistiti (id video -> conteggio). Vuoto se assenti. */
export async function readSavedStore(
  openId: string,
): Promise<Record<string, number>> {
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
    // File assente o illeggibile: si riparte da store vuoto.
    return {};
  }
}

/** Salva l'intera mappa dei "salvati" noti. Best-effort, serializzato. */
export function writeSavedStore(
  openId: string,
  byVideo: Record<string, number>,
): Promise<void> {
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
