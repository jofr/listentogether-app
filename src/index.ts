import { App } from "@capacitor/app";
import { registerPlugin } from "@capacitor/core";

import { ListenTogetherApp } from "./user_interface/app";
import { AudioElementPlayer } from "./player/audio_element_player";
import { ListeningSession } from "./listening/session";
import { AudioPlayer } from "./player/audio_player";
import "./metadata/cache";
import "./user_interface/app";

import "@material/mwc-button";
import "@material/mwc-textfield";
import "@material/mwc-list";
import "@material/mwc-list/mwc-check-list-item";
import "@material/mwc-circular-progress-four-color";
import "@material/mwc-ripple";
import "@material/mwc-slider";
import "@material/mwc-icon-button";
import "@material/mwc-fab";
import "@material/mwc-snackbar/mwc-snackbar";
import '@material/mwc-menu/mwc-menu';

import "./user_interface/elements/listener_avatar";
import "./user_interface/elements/loading_placeholder";
import "./user_interface/dialogs/add_audio_dialog";
import "./user_interface/dialogs/join_listening_dialog";
import "./user_interface/dialogs/invite_listener_dialog";
import "./user_interface/dialogs/share_settings_dialog";
import "./user_interface/pages/now_playing";
import "./user_interface/pages/playlist";
import "./user_interface/session_controls/session_controls";
import "./user_interface/menu";
 
declare global { 
    interface Window {
        app: ListenTogetherApp;
        player: AudioPlayer;
        session: ListeningSession;
        backButton: BackButtonStack;
    }
}

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

/* Plugin makes it possible to get URLs shared from androids native share to functionality */
interface ShareTargetPlugin {
    addListener(event: string, callback: (...args: any[]) => void): void;
}

const shareTarget = registerPlugin<ShareTargetPlugin>('ShareTarget');
shareTarget.addListener("receiveshare", (share: any) => {
    if (share.text) {
        //document.querySelector("add-audio-dialog").setInput(share.text);
        window.app.showDialog("add-audio-dialog");
    }
});

/* Reload on hash change or if android app opened with specific URL for hash */
window.addEventListener("hashchange", () => window.location.reload());

App.addListener('appUrlOpen', data => {
    const url = new URL(data.url);
    if (url.hash !== "") {
        window.location.href = `http://localhost/${url.hash}`;
    }
});

/* Set up global peer as window property to dispatch event on change (relevant for user interface elements) */
let listeningSession: ListeningSession | null = null;

Object.defineProperty(window, "session", {
    get: function() {
        return listeningSession;
    },

    set: function(session: ListeningSession) {
        listeningSession = session;
        session.on("listenertohost", () => { (document.querySelector("#listener-to-host-snackbar") as any).show(); });
        window.player.listeningState = listeningSession.listeningState;
        window.dispatchEvent(new CustomEvent("sessionchange"));
    }
});

/* Set up initial host peer */
window.app = document.querySelector("listen-together-app");
window.player = new AudioElementPlayer();
window.session = ListeningSession.CreateHost();

/* Get viewport size without browser chrome for correct initial sizing (TODO: change as soon as svh unit is widely supported) */
const calculateSvh = () => {
    let svh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--svh', `${svh}px`);
}
window.addEventListener("resize", calculateSvh);
calculateSvh();

async function initializeServiceWorker() {
    await navigator.serviceWorker.register(new URL("service-worker.ts", import.meta.url), { type: "module" });
}

document.addEventListener("DOMContentLoaded", () => {
    /* Get preferred color scheme and switch to dark mode if preferred */
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add("dark-mode"); /* TODO: needs some fixes for material web components */
    }

    /* If hash in URL set up potential listener and show join listening dialog */
    if (window.location.hash.length > 0) {
        const potentialSession = ListeningSession.CreateListener(window.location.hash.substring(1));
        document.querySelector("join-listening-dialog").session = potentialSession;
        window.app.showDialog("join-listening-dialog");
    }

    if ("serviceWorker" in navigator) {
        initializeServiceWorker();
    }
});