import { cookies } from "next/headers";
import { appUrl, refreshAccessToken, type TokenResponse } from "./tiktok";

const ACCESS_COOKIE = "tt_access_token";
const REFRESH_COOKIE = "tt_refresh_token";
const EXPIRES_COOKIE = "tt_expires_at";
const OPEN_ID_COOKIE = "tt_open_id";
export const STATE_COOKIE = "tt_oauth_state";

// Rinnova l'access token quando mancano meno di 2 minuti alla scadenza,
// così nessuna richiesta parte con un token sul punto di morire.
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

// Se più richieste concorrenti trovano il token scaduto, condividono lo
// stesso refresh: TikTok può ruotare il refresh token e una seconda
// chiamata con quello vecchio invaliderebbe la sessione.
const refreshInFlight = new Map<string, Promise<TokenResponse>>();

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
 * Ritorna un access token valido, rinnovandolo in automatico col refresh
 * token quando serve. Va chiamata solo da route handler o server action
 * (setta cookie). Ritorna null se la sessione non è recuperabile.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  const expiresAt = Number(store.get(EXPIRES_COOKIE)?.value ?? 0);

  if (access && Date.now() < expiresAt - REFRESH_MARGIN_MS) return access;

  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;

  try {
    let pending = refreshInFlight.get(refresh);
    if (!pending) {
      pending = refreshAccessToken(refresh).finally(() =>
        refreshInFlight.delete(refresh),
      );
      refreshInFlight.set(refresh, pending);
    }
    const token = await pending;
    await setAuthCookies(token);
    return token.access_token;
  } catch {
    return null;
  }
}
