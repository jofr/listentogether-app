import { registerRoute } from "workbox-routing";

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", () => {
    clients.claim();
});

async function messageClient(message: any) {
    for (const client of await self.clients.matchAll()) {
        client.postMessage(message);
    }
}

const shareTargetHandler = async ({event}) => {
    await messageClient("share-target");
    return Response.redirect("https://localhost:8080/#", 303);
}

registerRoute("/share-target", shareTargetHandler, "POST");