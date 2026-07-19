import { NextResponse } from "next/server";
import { collectStats } from "@/lib/collect";
import { getOpenId, getValidAccessToken } from "@/lib/session";
import { TikTokApiError } from "@/lib/tiktok";

// Endpoint di sola lettura per il client (poll ogni 5s): dati live dell'API
// TikTok + "salvati" dallo store. Nessuno scraping qui (lo fa il collettore),
// quindi risposta rapida; il margine copre solo la paginazione di video/list.
export const maxDuration = 30;

export async function GET() {
  const accessToken = await getValidAccessToken();
  const openId = await getOpenId();
  if (!accessToken || !openId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // Client: solo dati live dell'API TikTok + "salvati" dallo store. Niente
    // scraping né storicizzazione: quelli li fa il collettore sul server.
    const payload = await collectStats(openId, accessToken, {
      scrape: false,
      record: false,
    });
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof TikTokApiError && err.isAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Errore /api/stats:", err);
    return NextResponse.json(
      { error: "tiktok_api_error", message },
      { status: 502 },
    );
  }
}
