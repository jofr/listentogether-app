import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { RangeRequestsPlugin } from "workbox-range-requests";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", () => {
    clients.claim();
});

registerRoute(
    ({ url }) => url.origin === "https://fonts.googleapis.com",
    new StaleWhileRevalidate({
        cacheName: "google-fonts-stylesheets",
        plugins: [
            new ExpirationPlugin ({
                maxAgeSeconds: 365 * 24 * 60 * 60,
                purgeOnQuotaError: true,
            }),
        ],
    })
);
  
registerRoute(
    ({ url }) => url.origin === "https://fonts.gstatic.com",
    new CacheFirst({
        cacheName: "google-fonts-webfonts",
        plugins: [
            new CacheableResponsePlugin({
                statuses: [0, 200],
            }),
            new ExpirationPlugin({
                maxAgeSeconds: 365 * 24 * 60 * 60,
                maxEntries: 100,
                purgeOnQuotaError: true,
            }),
        ],
    })
);

/*registerRoute(
    ({ request }) => request.destination === "audio",
    new CacheFirst({
        cacheName: "audio-cache",
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }), // 0: opaque responses (cors)
            new RangeRequestsPlugin(),
        ],
    })
);*/