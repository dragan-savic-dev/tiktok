import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureSchema, hasDb, sql } from "./db";

// Store dei token per utente, così la raccolta in background può storicizzare
// anche ad app chiusa. Salviamo anche il refresh token: è la fonte unica di
// verità del rinnovo. Il rischio storico (rinnovare in background ruota il
// refresh token e invaliderebbe la sessione del browser) è neutralizzato perché
// ANCHE il browser rinnova passando da questo store (vedi lib/token.ts): esiste
// un solo refresh token, non due copie che si invalidano a vicenda.
//
// Due backend: Neon quando c'è DATABASE_URL (necessario su Vercel, dove il
// filesystem è effimero), altrimenti filesystem (.data/users) in locale/VPS.

const DIR = path.join(process.cwd(), ".data", "users");

export interface StoredUserToken {
  openId: string;
  accessToken: string;
  /** Epoch ms di scadenza dell'access token. */
  expiresAt: number;
  /** Refresh token corrente (assente per le sessioni pre-migrazione). */
  refreshToken?: string;
  /** Epoch ms di scadenza del refresh token (~365 giorni, si estende a ogni refresh). */
  refreshExpiresAt?: number;
}

function fileFor(openId: string): string {
  const safe = openId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DIR, `${safe}.json`);
}

/**
 * Salva/aggiorna l'intero set di token dell'utente (access + refresh). Chiamata
 * al login e a ogni rinnovo, così lo store resta la fonte unica del refresh
 * token. Best-effort: ingoia gli errori.
 */
export async function saveFullToken(t: StoredUserToken): Promise<void> {
  if (hasDb()) {
    try {
      await ensureSchema();
      await sql!`
        INSERT INTO users (open_id, access_token, token_expires_at, refresh_token, refresh_expires_at, last_seen_at)
        VALUES (${t.openId}, ${t.accessToken}, ${t.expiresAt}, ${t.refreshToken ?? null}, ${t.refreshExpiresAt ?? null}, now())
        ON CONFLICT (open_id) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          token_expires_at = EXCLUDED.token_expires_at,
          refresh_token = COALESCE(EXCLUDED.refresh_token, users.refresh_token),
          refresh_expires_at = COALESCE(EXCLUDED.refresh_expires_at, users.refresh_expires_at),
          last_seen_at = now()
      `;
    } catch {
      // best-effort
    }
    return;
  }

  try {
    await mkdir(DIR, { recursive: true });
    await writeFile(fileFor(t.openId), JSON.stringify(t), "utf8");
  } catch {
    // best-effort
  }
}

/** Token salvati per un singolo utente, o null se assente/illeggibile. */
export async function getStoredToken(
  openId: string,
): Promise<StoredUserToken | null> {
  if (hasDb()) {
    try {
      await ensureSchema();
      const rows = (await sql!`
        SELECT open_id, access_token, token_expires_at, refresh_token, refresh_expires_at
        FROM users
        WHERE open_id = ${openId}
        LIMIT 1
      `) as {
        open_id: string;
        access_token: string | null;
        token_expires_at: unknown;
        refresh_token: string | null;
        refresh_expires_at: unknown;
      }[];
      const r = rows[0];
      if (!r || (!r.access_token && !r.refresh_token)) return null;
      return {
        openId: r.open_id,
        accessToken: r.access_token ?? "",
        expiresAt: Number(r.token_expires_at ?? 0),
        refreshToken: r.refresh_token ?? undefined,
        refreshExpiresAt:
          r.refresh_expires_at != null ? Number(r.refresh_expires_at) : undefined,
      };
    } catch {
      return null;
    }
  }

  try {
    const raw = await readFile(fileFor(openId), "utf8");
    return JSON.parse(raw) as StoredUserToken;
  } catch {
    return null;
  }
}

/** Tutti i token salvati (per il ciclo di raccolta). */
export async function listUserTokens(): Promise<StoredUserToken[]> {
  if (hasDb()) {
    try {
      await ensureSchema();
      const rows = (await sql!`
        SELECT open_id, access_token, token_expires_at, refresh_token, refresh_expires_at
        FROM users
        WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL
      `) as {
        open_id: string;
        access_token: string | null;
        token_expires_at: unknown;
        refresh_token: string | null;
        refresh_expires_at: unknown;
      }[];
      return rows.map((r) => ({
        openId: r.open_id,
        accessToken: r.access_token ?? "",
        expiresAt: Number(r.token_expires_at ?? 0),
        refreshToken: r.refresh_token ?? undefined,
        refreshExpiresAt:
          r.refresh_expires_at != null ? Number(r.refresh_expires_at) : undefined,
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
