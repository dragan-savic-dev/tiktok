import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { STATE_COOKIE, VERIFIER_COOKIE } from "@/lib/session";
import {
  appUrl,
  buildAuthUrl,
  deriveCodeChallenge,
  generateCodeVerifier,
} from "@/lib/tiktok";

export async function GET() {
  const state = crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await deriveCodeChallenge(codeVerifier);

  const cookieOptions = {
    httpOnly: true,
    secure: appUrl().startsWith("https"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };

  const store = await cookies();
  store.set(STATE_COOKIE, state, cookieOptions);
  store.set(VERIFIER_COOKIE, codeVerifier, cookieOptions);

  return NextResponse.redirect(buildAuthUrl(state, codeChallenge));
}
