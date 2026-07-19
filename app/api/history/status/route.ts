import { NextResponse } from "next/server";
import { getHistoryStatus } from "@/lib/history";
import { getOpenId } from "@/lib/session";

// Stato sintetico dello storico DB (primo/ultimo t + conteggio): il pulsante
// globale di sync lo confronta col localStorage per capire se c'è roba nuova.
export async function GET() {
  const openId = await getOpenId();
  if (!openId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const status = await getHistoryStatus(openId);
  return NextResponse.json(status);
}
