// Service worker per la PWA. Regola d'oro: NON intercettare mai /api/*, così i
// contatori live (fetch a /api/stats ogni 5s) arrivano sempre freschi dalla
// rete e non vengono "congelati" dalla cache.
const CACHE = "ttstats-v1";
const OFFLINE_URL = "/offline.html";
const STATIC_RE = /\.(?:png|svg|ico|webmanifest|woff2?|css|js)$/;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)).catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // dati live: sempre rete, mai cache

  // Asset statici con hash immutabile: stale-while-revalidate
  if (url.pathname.startsWith("/_next/static/") || STATIC_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Navigazioni: network-first con fallback offline
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Tutto il resto (HMR, streaming, ecc.): gestione normale del browser
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || (await cache.match(OFFLINE_URL)) || Response.error();
  }
}
