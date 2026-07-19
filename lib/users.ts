import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureSchema, hasDb, sql } from "./db";

// Store minimale degli access token per utente, così il job di raccolta (cron su
// Vercel, o interval in locale) può storicizzare anche ad app chiusa. Volutamente
// NON salviamo il refresh token: usare/rinnovare quello in background lo ruoterebbe
// (TikTok lo cambia a ogni refresh) invalidando la sessione dell'utente. Con il
// solo access token (~24h) la raccolta continua finché è valido; alla scadenza
// riprende alla successiva visita dell'utente.
//
// Due backend: Neon quando c'è DATABASE_URL (necessario su Vercel, dove il
// filesystem è effimero), altrimenti filesystem (.data/users) in locale/VPS.

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
  if (hasDb()) {
    try {
      await ensureSchema();
      await sql!`
        INSERT INTO users (open_id, access_token, token_expires_at, last_seen_at)
        VALUES (${openId}, ${accessToken}, ${expiresAt}, now())
        ON CONFLICT (open_id) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          token_expires_at = EXCLUDED.token_expires_at,
          last_seen_at = now()
      `;
    } catch {
      // best-effort
    }
    return;
  }

  try {
    await mkdir(DIR, { recursive: true });
    const data: StoredUserToken = { openId, accessToken, expiresAt };
    await writeFile(fileFor(openId), JSON.stringify(data), "utf8");
  } catch {
    // best-effort
  }
}

/** Tutti i token salvati ancora validi (per il ciclo di raccolta). */
export async function listUserTokens(): Promise<StoredUserToken[]> {
  if (hasDb()) {
    try {
      await ensureSchema();
      const rows = (await sql!`
        SELECT open_id, access_token, token_expires_at
        FROM users
        WHERE access_token IS NOT NULL AND token_expires_at IS NOT NULL
      `) as { open_id: string; access_token: string; token_expires_at: unknown }[];
      return rows.map((r) => ({
        openId: r.open_id,
        accessToken: r.access_token,
        expiresAt: Number(r.token_expires_at),
      }));
    } catch {
      return [];
    }
  }

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
