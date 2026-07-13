import { NextResponse, type NextRequest } from "next/server";
import { getHistory } from "@/lib/history";
import { getOpenId } from "@/lib/session";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

export async function GET(request: NextRequest) {
  const openId = await getOpenId();
  if (!openId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = Number(request.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(raw)
    ? Math.min(MAX_DAYS, Math.max(1, Math.trunc(raw)))
    : DEFAULT_DAYS;

  const history = await getHistory(openId, days);
  return NextResponse.json(history);
}
