const CACHE_NAME = "ninaivu-pwa-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/favicon.svg", "/pwa-icons/icon-192.png", "/pwa-icons/icon-512.png"];
const STATIC_BUNDLE_PREFIX = "/assets/";
const STATIC_PUBLIC_PATHS = new Set(["/favicon.svg", "/logo.png", "/pwa-icons/icon-192.png", "/pwa-icons/icon-512.png"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("ninaivu-pwa-") && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Keep API responses and private archive data out of Cache Storage.
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          } catch {
            // A cache quota/error must not block the network response.
          }
        }
        return response;
      } catch {
        return (await caches.match(request))
          || (await caches.match("/index.html"))
          || (await caches.match("/"));
      }
    })());
    return;
  }

  const isStaticBundle = url.pathname.startsWith(STATIC_BUNDLE_PREFIX);
  if (!isStaticBundle && !STATIC_PUBLIC_PATHS.has(url.pathname)) return;

  event.respondWith((async () => {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      } catch {
        // A cache quota/error must not block the network response.
      }
    }
    return response;
  })());
});
