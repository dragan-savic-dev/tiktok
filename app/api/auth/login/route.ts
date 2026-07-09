import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { STATE_COOKIE } from "@/lib/session";
import { appUrl, buildAuthUrl } from "@/lib/tiktok";

export async function GET() {
  const state = crypto.randomUUID();

  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: appUrl().startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildAuthUrl(state));
}
