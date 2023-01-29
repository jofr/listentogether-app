import { App } from "@capacitor/app";
import { registerPlugin } from "@capacitor/core";

import { Settings } from "./settings";
import { ListenTogetherApp } from "./user_interface/app";
import { AudioElementPlayer } from "./player/audio_element_player";
import { ListeningSession } from "./listening/session";
import { AudioPlayer } from "./player/audio_player";
import "./metadata/cache";
import { extractUrls } from "./util/util";
 
declare global { 
    interface Window {
        settings: Settings;
        app: ListenTogetherApp;
        player: AudioPlayer;
        session: ListeningSession;
        backButton: BackButtonStack;
        setUpInitialHostSession: Function;
        setUpPotentialListeningSession: Function;
    }
}

window.settings = new Settings();

// Get viewport size without browser chrome for correct initial sizing
// TODO: Change this as soon as svh unit is supported widely enough
const calculateSvh = () => {
    let svh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--svh', `${svh}px`);
}
window.addEventListener("resize", calculateSvh);
calculateSvh();

class BackButtonStack {
    private callbackStack = [];

    constructor() {
        window.addEventListener("popstate", this.pop)
    }

    pop = () => {
        const callback = this.callbackStack.pop();
        if (callback) {
            callback();
        }
    }

    push = (callback) => {
        this.callbackStack.push(callback);
        window.history.pushState({}, "");
    }
}

window.backButton = new BackButtonStack();

// Plugin makes it possible to get audio URLs from Androids native "Share
// to"-functionality
interface ShareTargetPlugin {
    addListener(event: string, callback: (...args: any[]) => void): void;
}

const shareTarget = registerPlugin<ShareTargetPlugin>('ShareTarget');
shareTarget.addListener("receiveshare", (share: any) => {
    if (share.text) {
        const urls = extractUrls(share.text);
        if (urls !== null) {
            window.app.showDialog("add-audio-dialog");
            document.querySelector("add-audio-dialog").getPossibleAudiosFromUrls(urls);
        }
    }
});

// Reload on hash change or if Android app opened with specific URL for hash
window.addEventListener("hashchange", () => window.location.reload());

App.addListener('appUrlOpen', data => {
    const url = new URL(data.url);
    if (url.hash !== "") {
        window.location.href = `http://localhost/${url.hash}`;
    }
});

// Set up global session as window property to dispatch event on change
// (relevant for user interface elements)
let listeningSession: ListeningSession | null = null;

Object.defineProperty(window, "session", {
    get: function() {
        return listeningSession;
    },

    set: function(session: ListeningSession) {
        if (session === listeningSession) {
            return;
        }

        listeningSession?.closePeerConnections();
        listeningSession = session;
        session.on("listenertohost", () => { (document.querySelector("#listener-to-host-snackbar") as any).show(); });
        window.player.listeningState = listeningSession.listeningState;
        window.dispatchEvent(new CustomEvent("sessionchange"));
    }
});

window.setUpInitialHostSession = () => {
    window.player = new AudioElementPlayer();
    window.session = ListeningSession.CreateHost();
}

window.setUpPotentialListeningSession = () => {
    const potentialSession = ListeningSession.CreateListener(window.location.hash.substring(1));
    document.querySelector("join-listening-dialog").session = potentialSession;
    window.app.showDialog("join-listening-dialog");
}

// Get app reference
window.app = document.querySelector("listen-together-app");

// Create audio player and initial host session (unless this is the first use of
// the app in which case this happens after the user has agreed to how data is
// transferred and handled)
if (!window.settings.firstUse) {
    window.setUpInitialHostSession();
}

document.addEventListener("DOMContentLoaded", () => {
    // On first use get the preferred color scheme and save it as a setting.
    // Setting this again on subsequent starts ensures that the appropriate
    // "dark-mode" class is added to the body element.
    if ((window.matchMedia('(prefers-color-scheme: dark)').matches && window.settings.firstUse) || window.settings.darkMode) {
        window.settings.darkMode = true;
    }

    // If there is a hash in the URL set up a potential listener and show the
    // dialog to join the listening
    if (window.location.hash.length > 0 && !window.settings.firstUse) {
        window.setUpPotentialListeningSession();
    }

    if (window.settings.firstUse) {
        window.app.showDialog("first-use-dialog");
    }
});

async function initializeServiceWorker() {
    await navigator.serviceWorker.register(new URL("service-worker.ts", import.meta.url), { type: "module" });
}

window.addEventListener("load", () => {
    if ("serviceWorker" in navigator) {
        initializeServiceWorker();
    }
});