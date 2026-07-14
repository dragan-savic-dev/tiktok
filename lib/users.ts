import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Store minimale degli access token per utente, così il job in background può
// raccogliere snapshot anche ad app chiusa. Volutamente NON salviamo il refresh
// token: usare/rinnovare quello in background lo ruoterebbe (TikTok lo cambia a
// ogni refresh) invalidando la sessione dell'utente. Con il solo access token
// (durata ~24h) la raccolta continua finché il token è valido, senza rischi;
// alla scadenza riprende alla successiva visita dell'utente.

const DIR = path.join(process.cwd(), ".data", "users");

export interface StoredUserToken {
  openId: string;
  accessToken: string;
  /** Epoch ms di scadenza dell'access token. */
  expiresAt: number;
}

function fileFor(openId: string): string {
  const safe = openId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DIR, `${safe}.json`);
}

/** Salva/aggiorna l'access token dell'utente. Best-effort: ingoia gli errori. */
export async function saveUserToken(
  openId: string,
  accessToken: string,
  expiresAt: number,
): Promise<void> {
  try {
    await mkdir(DIR, { recursive: true });
    const data: StoredUserToken = { openId, accessToken, expiresAt };
    await writeFile(fileFor(openId), JSON.stringify(data), "utf8");
  } catch {
    // best-effort
  }
}

/** Tutti i token salvati (per il ciclo di raccolta in background). */
export async function listUserTokens(): Promise<StoredUserToken[]> {
  try {
    const files = await readdir(DIR);
    const users: StoredUserToken[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await readFile(path.join(DIR, f), "utf8");
        users.push(JSON.parse(raw) as StoredUserToken);
      } catch {
        // file singolo illeggibile: salta
      }
    }
    return users;
  } catch {
    return [];
  }
}
