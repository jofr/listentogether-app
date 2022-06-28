import { registerPlugin } from "@capacitor/core";

import { SyncedPlayerHost } from "./synced_player/synced_player_host";
import { SyncedPlayerListener } from "./synced_player/synced_player_listener";
import { ListenTogetherApp } from "./user_interface/app";
import "./user_interface/app";

interface ShareTargetPlugin {
    addListener(event: string, callback: (...args: any[]) => void): void;
}

declare global {
    interface Window {
        app: ListenTogetherApp;
        shareTarget: ShareTargetPlugin;
        syncedPlayer: SyncedPlayerHost | SyncedPlayerListener;
    }
}

window.shareTarget = registerPlugin<ShareTargetPlugin>('ShareTarget');

/* Set up global synced player property to dispatch event on change (relevant for user interface elements) */
let _syncedPlayer: SyncedPlayerHost | SyncedPlayerListener | null = null;

Object.defineProperty(window, "syncedPlayer", {
    get: function() {
        return _syncedPlayer;
    },

    set: function(syncedPlayer: SyncedPlayerHost | SyncedPlayerListener) {
        _syncedPlayer = syncedPlayer;
        window.dispatchEvent(new CustomEvent("syncedplayerchange"));
    }
});

/* Get viewport size without browser chrome for correct initial sizing (TODO: change as soon as svh unit is widely supported) */
let svh = window.innerHeight * 0.01;
document.documentElement.style.setProperty('--svh', `${svh}px`);

async function initializeServiceWorker() {
    await navigator.serviceWorker.register(new URL("service-worker.ts", import.meta.url), { type: "module" });
}

document.addEventListener("DOMContentLoaded", () => {
    /* Get preferred color scheme and switch to dark mode if preferred */
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        //document.body.classList.add("dark-mode"); /* TODO: needs some fixes for material web components */
    }

    /* Set up initial synced player host (after DOMContentLoaded so that user interface gets syncedplayerchange event) */
    window.app = document.querySelector("listen-together-app");
    window.syncedPlayer = new SyncedPlayerHost();

    /* If hash in URL set up potential listener and show join listening dialog */
    if (window.location.hash.length > 0) {
        const potentialListener = new SyncedPlayerListener(window.location.hash.substring(1));
        document.querySelector("join-listening-dialog").player = potentialListener;
        window.app.showDialog("join-listening-dialog");
    }

    if ("serviceWorker" in navigator) {
        initializeServiceWorker();
    }
});