import { html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators";
import { until } from 'lit/directives/until.js';
import "@material/mwc-button";
import "@material/mwc-textfield";
import "@material/mwc-list";
import "@material/mwc-list/mwc-check-list-item";
import "@material/mwc-circular-progress-four-color";

import { ModalDialog } from "./modal_dialog";
import { ListeningSession } from "../../listening/session";
import { ListeningListener, ConnectionState } from "../../listening/peer";
import { AudioInfo } from "../../metadata/types";

const defaultCoverData = `<svg xmlns="http://www.w3.org/2000/svg" height="48" width="48"><path d="M19.65 42Q16.5 42 14.325 39.825Q12.15 37.65 12.15 34.5Q12.15 31.35 14.325 29.175Q16.5 27 19.65 27Q21.05 27 22.175 27.4Q23.3 27.8 24.15 28.5V6H35.85V12.75H27.15V34.5Q27.15 37.65 24.975 39.825Q22.8 42 19.65 42Z"/></svg>`;
const defaultCoverObjectUrl = URL.createObjectURL(new Blob([defaultCoverData], { type: "image/svg+xml" }));

declare global {
    interface HTMLElementTagNameMap {
        "join-listening-dialog": JoinListeningDialog;
    }
}

@customElement("join-listening-dialog")
export class JoinListeningDialog extends ModalDialog {
    static styles = [
        ModalDialog.styles,
        css`
            mwc-list {
                --mdc-theme-on-surface: var(--on-surface);
                --mdc-theme-text-primary-on-background: var(--on-surface);
                --mdc-theme-text-secondary-on-background: var(--on-surface-variant);
                --mdc-theme-text-icon-on-background: var(--on-surface-variant);
                --mdc-theme-text-hint-on-background: var(--on-surface-variant);
                --mdc-checkbox-unchecked-color: var(--on-surface-variant);
                --mdc-checkbox-checked-color: var(--secondary);
                --mdc-checkbox-ink-color: var(--on-secondary);

                overflow-y: scroll;
                margin-left: -16px;
                margin-right: -16px;
            }
            
            mwc-circular-progress-four-color {
                margin: 0px auto;
            }
        `
    ];

    private possibleSession: ListeningSession = null;

    set session(session: ListeningSession) {
        this.possibleSession = session;
        this.possibleSession.subscribe(["playlist"], () => this.requestUpdate());
        this.possibleSession.listeningPeer.on("hostconnectionstate", () => this.requestUpdate());
    }

    @state()
    get session() {
        return this.possibleSession;
    }

    @state()
    possiblePlaylist: AudioInfo[] = [];

    private async join() {
        if (this.session) {
            window.session.closePeerConnections();
            window.session = this.session;
            this.possibleSession = null;
        }
        super.hide();
    }

    private dontJoin() {
        if (this.session) {
            /* TODO: also disconnect/destroy the object correctly */
            this.possibleSession = null;
        }
        super.hide();
    }

    hide() {
        this.dontJoin();
    }

    renderConnecting() {
        return html`
            <p>You have been invited to listen to a playlist together 📻 Please wait a moment while we connect you to your host...</p>
            <mwc-circular-progress-four-color indeterminate></mwc-circular-progress-four-color>
        `
    }

    renderConnected() {
        return html`
            <p>You have been invited to listen to a playlist together 📻 Do you want to join listening? 😃</p>
            <mwc-list>
                ${this.possibleSession.playlist.map(audio => html`
                    <mwc-list-item twoline graphic="medium">
                        <span>${until(window.metadataCache.getAudioInfo(audio.uri).then(audio => audio.title), html`<loading-placeholder characters="15"></loading-placeholder>`)}</span>
                        <span slot="secondary">${until(window.metadataCache.getAudioInfo(audio.uri).then(audio => audio.album), html`<loading-placeholder characters="10"></loading-placeholder>`)}</span>
                        <img slot="graphic" src="${until(window.metadataCache.getAudioInfo(audio.uri).then(audio => audio.cover.url), defaultCoverObjectUrl)}" />
                    </mwc-list-item>
                `)}
            </mwc-list>
        `
    }

    renderError() {
        return html`
            <p>Sorry, we cannot connect you to your host, they probably stopped listening 📻 But you can start a new playlist instead and invite someone else 😃</p>
        `;
    }

    renderContent() {
        if (!this.possibleSession || (this.possibleSession.listeningPeer as ListeningListener).hostConnectionState === ConnectionState.CONNECTING) {
            return this.renderConnecting();
        } else if ((this.possibleSession.listeningPeer as ListeningListener).hostConnectionState === ConnectionState.CONNECTED) {
            return this.renderConnected();
        } else {
            return this.renderError();
        }
    }

    renderActions() {
        if ((this.possibleSession?.listeningPeer as ListeningListener).hostConnectionState === ConnectionState.ERROR) {
            return html`
                <mwc-button label="Try again!" @click=${() => window.location.reload()}></mwc-button>
                <mwc-button unelevated label="Start new!" @click=${this.dontJoin}></mwc-button>
            `
        } else {
            return html`
                <mwc-button label="Don't join" @click=${this.dontJoin}></mwc-button>
                <mwc-button ?disabled=${!this.possibleSession || (this.possibleSession.listeningPeer as ListeningListener).hostConnectionState !== ConnectionState.CONNECTED} unelevated icon="group_add" label="Join listening!" @click=${this.join}></mwc-button>
            `
        }
    }
}