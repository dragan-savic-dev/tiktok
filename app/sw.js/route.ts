// Il service worker è servito da una route (non da public/) così possiamo
// iniettare un ID di build: cambiando i byte del file a ogni deploy, il
// browser rileva la nuova versione e mostra il popup di aggiornamento.
const VERSION = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

const SOURCE = `
const VERSION = ${JSON.stringify(VERSION)};
const CACHE = "ttstats-" + VERSION;
const OFFLINE_URL = "/offline.html";
const STATIC_RE = /\\.(?:png|svg|ico|webmanifest|woff2?|css|js)$/;

self.addEventListener("install", (event) => {
  // Niente skipWaiting automatico: il nuovo SW resta in attesa finché l'utente
  // non conferma dal popup (postMessage SKIP_WAITING).
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;
  // Dati live: sempre rete, mai cache -> i contatori restano aggiornati.
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || STATIC_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
    .catch(() => cached);
  return cached || network;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    return cached || (await cache.match(OFFLINE_URL)) || Response.error();
  }
}
`;

export function GET() {
  return new Response(SOURCE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
