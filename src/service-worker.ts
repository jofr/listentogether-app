import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { RangeRequestsPlugin } from "workbox-range-requests";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("install", () => {
    self.skipWaiting();
});
 
self.addEventListener("activate", () => {
    clients.claim();
});

/*registerRoute(
    ({ request }) => request.destination === "audio",
    new CacheFirst({
        cacheName: "audio-cache",
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] }), // 0: opaque responses (cors)
            new RangeRequestsPlugin(),
        ],
    })
);*/