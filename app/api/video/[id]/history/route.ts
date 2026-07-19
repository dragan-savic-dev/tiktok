import { NextResponse, type NextRequest } from "next/server";
import { hasDb } from "@/lib/db";
import { getOpenId } from "@/lib/session";
import { DAY_MS } from "@/lib/snapshots";
import { getVideoHistory } from "@/lib/video-snapshots";

// Serie temporale accumulata per un singolo video (da video_snapshots): abilita
// la curva dello share rate, le views nel tempo e la velocità nella pagina del
// video. Vuota senza DB o finché non si è accumulato abbastanza storico.
const DEFAULT_DAYS = 7;
const MAX_DAYS = 120;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const openId = await getOpenId();
  if (!openId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const raw = Number(request.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(raw)
    ? Math.min(MAX_DAYS, Math.max(1, Math.trunc(raw)))
    : DEFAULT_DAYS;

  const series = await getVideoHistory(openId, id, Date.now() - days * DAY_MS);
  return NextResponse.json({ series, dbEnabled: hasDb() });
}
