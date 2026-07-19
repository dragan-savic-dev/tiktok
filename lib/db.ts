import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { TikTokUser } from "./types";

// Client Neon (Postgres serverless su HTTP). È l'unico punto che conosce
// DATABASE_URL: se manca, `sql` è null e tutto il resto dell'app ripiega sullo
// store su filesystem/localStorage — così l'app continua a funzionare finché
// il DB non è configurato. Vedi README per la creazione del progetto Neon.
//
// In DB finiscono SOLO i dati "storicizzati nel tempo" (snapshot account e per
// singolo video, salvati, note): i valori live delle API TikTok si prendono
// sempre freschi e non si duplicano qui.

// L'integrazione Neon/Postgres di Vercel inietta la connection string con nomi
// diversi a seconda del prodotto: proviamo i più comuni, preferendo la versione
// "pooled" (adatta al serverless). In locale basta DATABASE_URL in .env.local
// (o `vercel env pull`).
const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  undefined;

export const sql: NeonQueryFunction<false, false> | null = url
  ? neon(url)
  : null;

export function hasDb(): boolean {
  return sql !== null;
}

// Bootstrap idempotente dello schema: gira una sola volta per processo. Le
// tabelle usano `t bigint` (epoch ms) per combaciare con gli snapshot lato
// client, senza conversioni di fuso.
let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        open_id text PRIMARY KEY,
        union_id text,
        username text,
        display_name text,
        access_token text,
        token_expires_at bigint,
        refresh_token text,
        refresh_expires_at bigint,
        created_at timestamptz DEFAULT now(),
        last_seen_at timestamptz DEFAULT now()
      )`;
      // Evoluzione schema: aggiunge le colonne token se la tabella preesisteva.
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token text`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expires_at bigint`;
      // Il refresh token abilita la raccolta autonoma (rinnovo lato server ad
      // app chiusa). Prima non veniva salvato: le righe preesistenti restano
      // senza finché l'utente non rifà il login.
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token text`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_expires_at bigint`;
      await sql`CREATE TABLE IF NOT EXISTS account_snapshots (
        open_id text NOT NULL,
        t bigint NOT NULL,
        followers integer,
        following integer,
        likes bigint,
        views bigint,
        comments bigint,
        shares bigint,
        saved bigint,
        videos integer,
        PRIMARY KEY (open_id, t)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS videos (
        open_id text NOT NULL,
        video_id text NOT NULL,
        create_time bigint,
        duration integer,
        title text,
        first_seen_at timestamptz DEFAULT now(),
        PRIMARY KEY (open_id, video_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS video_snapshots (
        open_id text NOT NULL,
        video_id text NOT NULL,
        t bigint NOT NULL,
        views bigint,
        likes bigint,
        comments bigint,
        shares bigint,
        saved bigint,
        PRIMARY KEY (open_id, video_id, t)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS video_saved (
        open_id text NOT NULL,
        video_id text NOT NULL,
        saved bigint NOT NULL,
        updated_at timestamptz DEFAULT now(),
        PRIMARY KEY (open_id, video_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS video_notes (
        open_id text NOT NULL,
        video_id text NOT NULL,
        battuta text,
        tipologia text,
        nome text,
        riutilizzabile text,
        nota text,
        updated_at timestamptz DEFAULT now(),
        PRIMARY KEY (open_id, video_id)
      )`;
    })().catch((err) => {
      // Se il bootstrap fallisce si riprova alla prossima chiamata.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

/**
 * Crea/aggiorna la riga utente. Best-effort: gli errori non devono mai rompere
 * la raccolta. Va chiamata quando abbiamo il profilo (in collectStats).
 */
export async function upsertUser(openId: string, user?: TikTokUser): Promise<void> {
  if (!sql) return;
  try {
    await ensureSchema();
    await sql`
      INSERT INTO users (open_id, union_id, username, display_name, last_seen_at)
      VALUES (${openId}, ${user?.union_id ?? null}, ${user?.username ?? null},
              ${user?.display_name ?? null}, now())
      ON CONFLICT (open_id) DO UPDATE SET
        union_id = COALESCE(EXCLUDED.union_id, users.union_id),
        username = COALESCE(EXCLUDED.username, users.username),
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        last_seen_at = now()
    `;
  } catch {
    // best-effort
  }
}
