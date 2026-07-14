import { NextResponse } from "next/server";
import { collectStats } from "@/lib/collect";
import { getOpenId, getValidAccessToken } from "@/lib/session";
import { TikTokApiError } from "@/lib/tiktok";

// Il ciclo che rinnova i "salvati" scarica un lotto di pagine con delle pause:
// su Vercel il default (10s) potrebbe non bastare con molti video.
export const maxDuration = 60;

export async function GET() {
  const accessToken = await getValidAccessToken();
  const openId = await getOpenId();
  if (!accessToken || !openId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const payload = await collectStats(openId, accessToken);
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
