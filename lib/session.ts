import { cookies } from "next/headers";
import { appUrl, type TokenResponse } from "./tiktok";
import { getValidAccessTokenFor, persistToken } from "./token";

const ACCESS_COOKIE = "tt_access_token";
const REFRESH_COOKIE = "tt_refresh_token";
const EXPIRES_COOKIE = "tt_expires_at";
const OPEN_ID_COOKIE = "tt_open_id";
export const STATE_COOKIE = "tt_oauth_state";
export const VERIFIER_COOKIE = "tt_oauth_verifier";

// Rinnova l'access token quando mancano meno di 2 minuti alla scadenza,
// così nessuna richiesta parte con un token sul punto di morire.
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: appUrl().startsWith("https"),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function setAuthCookies(token: TokenResponse): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, token.access_token, cookieOptions(token.expires_in));
  store.set(REFRESH_COOKIE, token.refresh_token, cookieOptions(token.refresh_expires_in));
  store.set(
    EXPIRES_COOKIE,
    String(Date.now() + token.expires_in * 1000),
    cookieOptions(token.refresh_expires_in),
  );
  store.set(OPEN_ID_COOKIE, token.open_id, cookieOptions(token.refresh_expires_in));

  // Persiste l'intero token (access + refresh) nello store server-side, fonte
  // unica del rinnovo per cron e dashboard. Atteso (non fire-and-forget): su
  // Vercel la funzione può congelarsi dopo la risposta, e questo salvataggio è
  // ciò che semina il refresh token su Neon per la raccolta di Hetzner.
  // saveFullToken ingoia i suoi errori, quindi l'await non fa mai fallire il login.
  await persistToken(token);
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, EXPIRES_COOKIE, OPEN_ID_COOKIE]) {
    store.delete(name);
  }
}

export async function hasSession(): Promise<boolean> {
  const store = await cookies();
  return store.has(REFRESH_COOKIE) || store.has(ACCESS_COOKIE);
}

export async function getOpenId(): Promise<string | null> {
  const store = await cookies();
  return store.get(OPEN_ID_COOKIE)?.value ?? null;
}

/**
 * Ritorna un access token valido, rinnovandolo in automatico quando serve. Va
 * chiamata solo da route handler o server action (setta cookie). Il cookie
 * access è solo una cache veloce: il rinnovo vero passa dallo store server-side
 * (lib/token.ts), unica fonte del refresh token, così browser e cron non si
 * invalidano a vicenda. Ritorna null se la sessione non è recuperabile.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  const expiresAt = Number(store.get(EXPIRES_COOKIE)?.value ?? 0);

  if (access && Date.now() < expiresAt - REFRESH_MARGIN_MS) return access;

  const openId = store.get(OPEN_ID_COOKIE)?.value;
  if (!openId) return null;

  const token = await getValidAccessTokenFor(openId);
  if (!token) return null;

  // Aggiorna solo la cache del cookie access; il refresh token resta lato server.
  const maxAge = Math.max(0, Math.floor((token.expiresAt - Date.now()) / 1000));
  store.set(ACCESS_COOKIE, token.accessToken, cookieOptions(maxAge));
  store.set(EXPIRES_COOKIE, String(token.expiresAt), cookieOptions(maxAge));
  return token.accessToken;
}
