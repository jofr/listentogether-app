import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators";
import { classMap } from "lit/directives/class-map";
import { Share } from '@capacitor/share';

import { ListeningHost, ListeningListener } from "../../listening/peer";
import { SessionController } from "../controllers/session";
import { placeholderTime, prettyTime } from "../../util/util";

declare global {
    interface HTMLElementTagNameMap {
        "player-timeline": PlayerTimeline;
        "player-controls": PlayerControls;
        "peer-controls": PeerControls;
        "session-controls": SessionControls;
    }
}

@customElement("player-timeline")
export class PlayerTimeline extends LitElement {
    static styles = css`
        :host {
            display: block;
        }

        mwc-slider {
            margin: 0px calc(-24px + var(--content-padding) - var(--icon-padding));
        }

        .time {
            position: relative;
            margin: 0px calc(var(--content-padding) - var(--icon-padding));
            top: -10px;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            font-size: calc(0.6rem + var(--maxified) * 0.2rem);
            height: 0.8rem;
        }
    `;

    private sessionController = new SessionController(this, { listen: ["timeupdate", "durationchange"] });

    render() {
        const session = this.sessionController.session;
        const disabled = !session || (session.listeningPeer instanceof ListeningListener) || !session.playback.currentAudio;
        const noAudio = !session || !session.playback.currentAudio;
        const duration = session?.playback.currentAudio ? session.player.duration : 1.0;
        const currentTime = session?.playback.currentAudio ? session.player.currentTime : 0.0;

        return html`
            <mwc-slider ?disabled=${disabled} @change=${(event: any) => session.seek(event.detail.value)} value="${currentTime}" min="0" max="${duration}"></mwc-slider>
            <div class="time">
                <span id="current">${noAudio ? nothing : prettyTime(currentTime)}</span>
                <span id="duration">${noAudio ? nothing : (Number.isNaN(duration) ? placeholderTime() : prettyTime(duration))}</span>
            </div>
        `
    }
}

@customElement("player-controls")
export class PlayerControls extends LitElement {
    static styles = css`
        :host {
            position: relative;
            display: block;
            height: 3.0rem;
            z-index: 1;
        }

        #controls {
            position: absolute;
            display: flex;
            flex-direction: row;
            justify-content: flex-end;
            align-items: center;
            width: -moz-fit-content;
            width: fit-content;
            right: calc(var(--maxified) * 50%);
            transform: translateX(calc(var(--maxified) * 50%));
        }

        mwc-icon-button {
            --mdc-icon-size: 2.5rem;
            --mdc-icon-button-size: 3.0rem;
            --mdc-icon-font: 'Material Symbols Outlined';
            --mdc-theme-text-disabled-on-light: var(--on-surface-opacity-38);
            margin: 0px calc(var(--maxified) * 0.25rem);
            color: var(--on-surface-variant);
        }

        mwc-icon-button.play {
            --mdc-ripple-color: transparent;
            --mdc-icon-size: calc(2.5rem + var(--maxified) * 1.5rem);
            margin: 0px calc(var(--maxified) * 0.75rem);
        }

        mwc-icon-button.only-maxified {
            opacity: calc((var(--maxified) - 0.5) * 2.0);
            width: calc(var(--maxified) * 3.0rem);
            transform: translateX(calc(-0.5 * var(--minified) * 3.0rem));
            overflow: hidden;
        }

        mwc-icon-button.rotating {
            animation: rotation 2s infinite linear;
        }

        @keyframes rotation {
            from {
                transform: rotate(0deg);
            }
            to {
                transform: rotate(360deg);
            }
        }
    `;

    private sessionController = new SessionController(this, { subscribe: ["playlist"], listen: ["play", "pause", "audiochange", "buffering", "canplay"] });

    render() {
        const session = this.sessionController.session;
        const disabled = !session || !(session.listeningPeer && session.listeningPeer instanceof ListeningHost) || !session.playback.currentAudio;
        const currentAudioIndex = (session && session.playback.currentAudio) ? session.listeningState.playlist.indexOf(session.playback.currentAudio) : -1;
        const playlistLength = (session && session.playlist) ? session.playlist.length : 0;
        const prevDisabled = currentAudioIndex === 0 ? true : false;
        const nextDisabled = currentAudioIndex === (playlistLength - 1) ? true : false;
        const buffering = (session && session.player) ? session.player.buffering : false;

        return html`
            <div id="controls">
                <mwc-icon-button ?disabled=${disabled || prevDisabled} @click=${() => session.skipPrevious()} icon="skip_previous"></mwc-icon-button>
                <mwc-icon-button ?disabled=${disabled} @click=${() => session.replay()} icon="replay_30" class="only-maxified"></mwc-icon-button>
                <mwc-icon-button ?disabled=${disabled} class="play ${classMap({"rotating": session && !session.playback.paused && buffering})}" @click=${() => session.togglePlay()} icon="${!session || session.playback.paused ? "play_circle" : (buffering ? "cached" : "pause_circle")}"></mwc-icon-button>
                <mwc-icon-button ?disabled=${disabled} @click=${() => session.forward()} icon="forward_30" class="only-maxified"></mwc-icon-button>
                <mwc-icon-button ?disabled=${disabled || nextDisabled} @click=${() => session.skipNext()} icon="skip_next"></mwc-icon-button>
            </div>
        `
    }
}


@customElement("peer-controls")
export class PeerControls extends LitElement {
    static styles = css`
        :host {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            z-index: 1;
        }

        #listeners {
            display: flex;
            flex-direction: row;
        }

        #listeners listener-avatar:not(:first-child) {
            margin-left: -0.75rem;
        }

        #listeners .unstable {
            opacity: 0.5;
        }

        #invite-border {
            position: relative;
            height: 2.5rem;
            border-radius: 1.75rem;
            margin-left: -0.75rem;
            background: linear-gradient(25deg, var(--primary), var(--secondary));
        }

        #invite {
            box-sizing: border-box;
            display: flex;
            flex-direction: row;
            align-items: center;
            height: 100%;
            padding: 0px 1.0rem 0px 0.75rem;
            border-radius: inherit;
            border: 1px solid transparent;
            color: var(--primary);
            background-color: var(--surface);
            background-clip: padding-box;
            cursor: pointer;
        }

        #invite span {
            font-size: 0.875rem;
        }

        #invite span.icon {
            font-family: 'Material Symbols Outlined';
            font-size: 0.875rem;
            margin-right: 0.5rem;
        }

        #invite span.text {
            font-size: 0.875rem;
            font-weight: 500;
        }

        mwc-icon-button {
            --mdc-icon-size: 1.5rem;
            --mdc-icon-button-size: 3.0rem;
            color: var(--on-surface-variant);
            overflow: hidden;
        }

        mwc-icon-button#settings {
            opacity: calc(var(--maxified) * 1.0);
            width: calc(var(--maxified) * 3.0rem);
            transform: translateX(calc(-1 * var(--minified) * 3.0rem));
        }
    `;

    private sessionController = new SessionController(this, { subscribe: ["listeners"] });

    inviteListener() {
        Share.canShare().then((canShare) => {
            if (canShare.value === true) {
                Share.share({
                    dialogTitle: "Invite listeners",
                    title: "Listen together with me!",
                    text: "I'd like to listen together with you ???? Come join me! ????",
                    url: this.sessionController.session.invitationUrl
                });
            } else {
                window.app.showDialog("invite-listener-dialog");
            }
        });
    }

    render() {
        const listeners = this.sessionController.session?.listeners || [];

        return html`
            <div id="listeners">
                ${listeners.map(listener => listener.connectionState === "disconnected" ? nothing : html`
                    <listener-avatar id="${listener.id}" name="${listener.name}" class="${listener.connectionState}"></listener-avatar>
                `)}
                <div id="invite-border">
                    <div id="invite" @click=${this.inviteListener}>
                        <span class="icon">share</span>
                        <span class="text">Invite</span>
                    </div>
                </div>
            </div>
            <mwc-icon-button id="settings" unelevated icon="settings" @click=${() => window.app.showDialog("share-settings-dialog")}></mwc-icon-button>
        `
    }
}

@customElement("session-controls")
export class SessionControls extends LitElement {
    static styles = css`
        :host {
            --maxified-height: 12.5rem;
            --minified-height: 7.75rem;
            --height-difference: calc(var(--maxified-height) - var(--minified-height));
            --maxified: var(--maxified-controls, 1.0);
            --minified: var(--minified-controls, 0.0);

            box-sizing: border-box;
            position: absolute;
            bottom: 0px;
            left: 0px;
            width: 100vw;
            height: calc(var(--minified-height) + var(--maxified) * var(--height-difference));
            padding: 0px var(--icon-padding) var(--icon-padding) var(--icon-padding);
            background-color: var(--surface);
            color: var(--on-surface);
            z-index: 20;
        }

        :host::before {
            content: '';
            position: absolute;
            left: 0px;
            bottom: 0px;
            width: 100%;
            height: 100%;
            background-color: var(--primary);
            opacity: calc(var(--minified) * 0.08);
        }

        peer-controls {
            position: absolute;
            left: var(--content-padding);
            bottom: var(--icon-padding);
            width: calc((100vw - var(--icon-padding) - var(--content-padding)));
        }

        peer-controls[minified] {
            width: 50%;
        }

        mwc-icon-button#add {
            position: absolute;
            right: var(--icon-padding);
            top: calc(-1 * (var(--icon-padding) + 3.5rem));
            --mdc-icon-button-size: 3.5rem;
            background-color: var(--primary-container);
            color: var(--on-primary-container);
            --mdc-ripple-color: transparent;
            border-radius: 1.0rem;
            z-index: 30;
            transform: scale(var(--minified-controls));
            box-shadow: var(--mdc-fab-box-shadow, 0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12));
        }
    `;

    @state()
    minified: boolean = false;

    private sessionController = new SessionController(this, { subscribe: [] });

    renderFab() {
        if (this.sessionController.session?.listeningPeer && this.sessionController.session.listeningPeer instanceof ListeningListener) {
            return nothing;
        } else {
            return html`<mwc-icon-button id="add" icon="playlist_add" @click=${() => window.app.showDialog("add-audio-dialog")}></mwc-icon-button>`;
        }
    }

    showHostTransformSnackbar() {
        this.shadowRoot.querySelector("mwc-snackbar").show();
    }

    render() {
        return html`
            <player-timeline></player-timeline>
            <player-controls></player-controls>
            <peer-controls ?minified=${this.minified}></peer-controls>
            ${this.renderFab()}
        `
    }
}