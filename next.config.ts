import type { NextConfig } from "next";

// ID di build stabile per deploy: su Vercel usa lo SHA del commit, altrimenti
// il timestamp della build. Viene iniettato nel service worker (vedi
// app/sw.js/route.ts) per far rilevare al browser le nuove versioni.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
};

export default nextConfig;
