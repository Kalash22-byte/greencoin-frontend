const cacheName = "greencoin-v1";
const assets = [
  "/dashboard.html",
  "/history.html",
  "/redeem.html",
  "/dashboard.js",
  "/manifest.json",
  "/"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(cacheName).then(cache => cache.addAll(assets))
  );
  self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
