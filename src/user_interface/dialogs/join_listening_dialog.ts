import { html, css } from "lit";
import { customElement, state } from "lit/decorators";
import "@material/mwc-button";
import "@material/mwc-textfield";
import "@material/mwc-list";
import "@material/mwc-list/mwc-check-list-item";
import "@material/mwc-circular-progress-four-color";

import { ModalDialog } from "./modal_dialog";
import { SyncedPlayerListener } from "../../synced_player/synced_player_listener";

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
            mwc-circular-progress-four-color {
                margin: 0px auto;
            }
        `
    ];

    private _player: SyncedPlayerListener = null;

    set player(player: SyncedPlayerListener) {
        this._player = player;
        this._player.on("playlistchange", () => this.requestUpdate());
        this._player.on("connectionchange", () => this.requestUpdate());
    }

    @state()
    get player() {
        return this._player;
    }

    private _join() {
        if (this._player) {
            this._player.silentAudioActivation();
            window.syncedPlayer = this._player;
            this._player = null;
        }
        super.hide();
    }

    private _dontJoin() {
        if (this._player) {
            /* TODO: also disconnect/destroy the object correctly */
            this._player = null;
        }
        super.hide();
    }

    hide() {
        this._dontJoin();
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
                ${this._player?.state.playlist.map(audio => html`
                    <mwc-list-item twoline graphic="medium">
                        <span>${audio.title}</span>
                        <span slot="secondary">${audio.album}</span>
                        <img slot="graphic" src="${URL.createObjectURL(new Blob([audio.cover.data], { type: audio.cover.format }))}" />
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
        if (!this._player || this._player.connectionStatus == "connecting") {
            return this.renderConnecting();
        } else if (this._player.connectionStatus == "connected") {
            return this.renderConnected();
        } else {
            return this.renderError();
        }
    }

    renderActions() {
        if (this._player?.connectionStatus == "error") {
            return html`
                <mwc-button label="Try again!" @click=${() => window.location.reload()}></mwc-button>
                <mwc-button unelevated label="Start new!" @click=${this._dontJoin}></mwc-button>
            `
        } else {
            return html`
                <mwc-button label="Don't join" @click=${this._dontJoin}></mwc-button>
                <mwc-button ?disabled=${!this._player || this._player.connectionStatus != "connected"} unelevated icon="group_add" label="Join listening!" @click=${this._join}></mwc-button>
            `
        }
    }
}