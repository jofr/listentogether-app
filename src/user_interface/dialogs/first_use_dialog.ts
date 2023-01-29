import { html, css } from "lit";
import { customElement } from "lit/decorators";

import { ModalDialog } from "./modal_dialog";
import { SessionController } from "../controllers/session";

declare global {
    interface HTMLElementTagNameMap {
        "first-use-dialog": FirstUseDialog;
    }
}

@customElement("first-use-dialog")
export class FirstUseDialog extends ModalDialog {
    static styles = [
        ModalDialog.styles,
        css`
            div.content {
                margin-top: var(--title-padding);
                padding-top: 0px;
            }

            p, ul {
                margin: 0.25rem 0px;
            }

            p:first-child {
                margin-top: 0px;
            }

            ul {
                padding-left: 1.25rem;
            }

            a {
                text-decoration: none;
            }
        `
    ];

    title = "Hello there! ✨"

    hide() {

    }

    private leave() {
        history.back();
    }

    private agree() {
        window.setUpInitialHostSession();
        if (window.location.hash.length > 0) {
            window.setUpPotentialListeningSession();
        }
        window.settings.firstUse = false;
        super.hide();
    }

    renderContent() {
        return html`
            <p>
                ListenTogether lets you and your friends listen to podcasts and audio playlists together 📻
            </p>
            <p>
                Before we can start please make sure that you agree to the way your data is transmitted and handled.
                A detailed description about this can be found in <a href="https://gitlab.com/listentogether/app/-/blob/main/README.md#how-does-it-work-how-is-my-data-transmitted-and-handled">the README of this project</a>.
                If you only need a summary, those are the most important points:
            </p>
            <ul>
                <li>ListenTogether uses WebRTC peer-to-peer connections to transmit data of audio files, metadata, playlists and playback state between peers participating in a listening. A listening is identified by a random alphanumeric ID and anybody who knows that ID can join the listening.</li>
                <li>Those WebRTC connections can only be established via a signaling server. The provided signaling server stores your IP address, your ID and necessary signaling data for as long as you are connected (but does not save or log any of this information permanently).</li>
                <li>If no direct peer-to-peer connection can be established a TURN server is used as a fallback. The provided TURN server relays all (end-to-end encrypted) communication between the affected peers and has to store the information necessary for relaying this traffic (e.g. IP addresses) for as long as the connection is active (but does not save or log any of this information permanently).</li>
                <li>If you use the integrated podcast search the provided server might relay those queries to the <a href="https://podcastindex.org/">Podcast Index</a> (if it has no cached response) but never transmits any other information to the Podcast Index and does not save or log any personally identifiable information permanently.</li>
            </ul>
        `
    }

    renderActions() {
        return html`
            <mwc-button label="Leave" @click=${this.leave}></mwc-button>
            <mwc-button unelevated icon="handshake" label="I agree!" @click=${this.agree}></mwc-button>
        `
    }
}