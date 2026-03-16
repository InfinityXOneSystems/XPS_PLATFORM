// XPS Intelligence Platform – Service Worker
// Provides offline support and installable PWA capabilities

const CACHE_NAME = "xps-intelligence-v1";
const STATIC_ASSETS = [
  "/",
  "/chat",
  "/leads",
  "/analytics",
  "/settings",
  "/manifest.json",
];

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Non-fatal: some assets may not exist yet
      });
    }),
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

// ── Fetch (Cache-first for static, Network-first for API) ────────────────────

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Always go to network for API calls
  if (url.pathname.startsWith("/agent/") || url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(JSON.stringify({ error: "Offline – API unavailable" }), {
            headers: { "Content-Type": "application/json" },
            status: 503,
          }),
      ),
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok && event.request.method === "GET") {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone));
          }
          return response;
        }),
    ),
  );
});

// ── Push Notifications ────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "XPS Intelligence";
  const options = {
    body: data.body || "New update available",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
