import { LitElement, html, css, TemplateResult, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators";
import {repeat} from "lit/directives/repeat.js";
import { Share } from '@capacitor/share';
import "@material/mwc-ripple";
import "@material/mwc-slider";
import "@material/mwc-icon-button";

import { PlayerState } from "../../synced_player/synced_player";
import { SyncedPlayerHost } from "../../synced_player/synced_player_host";
import { SyncedPlayerListener } from "../../synced_player/synced_player_listener";
import "../dialogs/add_audio_dialog";
import "../dialogs/modal_dialog";
import { classMap } from "lit/directives/class-map";
import { AddAudioDialog } from "../dialogs/add_audio_dialog";
import { clamp, prettyTime } from "../../util/util";
import { InviteListenerDialog } from "../dialogs/invite_listener_dialog";
import { SyncedPlayerController } from "../controllers/synced_player";

@customElement("cover-and-information")
export class CoverAndInformation extends LitElement {
    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            justify-content: center;
            scroll-snap-align: start;
        }

        #cover {
            width: var(--cover-size);
            height: var(--cover-size);
            margin: 0px auto;
            border-radius: 0.5rem;
            background-color: #b0e7ae;
            overflow: hidden;
        }

        #cover img {
            width: 100%;
        }

        #cover .add-audio {
            width: var(--cover-size);
            height: var(--cover-size);
            background-color: #b0e7ae;
            font-family: 'Material Symbols Outlined';
            font-size: max(12.0rem, calc(var(--cover-size) - 10.0rem));
            line-height: var(--cover-size);
            text-align: center;
            color: var(--mdc-theme-on-primary);
        }

        #information {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            text-align: left;
            margin-top: 0.75rem;
            padding: 0px var(--padding);
        }

        #information #title-and-album {
            overflow: hidden;
        }

        #information h1 {
            --overflow-width: 0px;
            --animation-duration: 0s;
            font-size: 1.1rem;
            font-weight: bold;
            line-height: 1.2;
            margin: 0px 0px 0.25rem 0px;
            white-space: nowrap;
            animation: title-animation ease-in-out alternate infinite;
            animation-duration: var(--animation-duration);
        }

        @keyframes title-animation {
            from { transform: translateX(0px); }
            to { transform: translateX(calc(-1.0 * var(--overflow-width))); }
        }

        #information h2 {
            font-size: 1.0rem;
            font-weight: normal;
            line-height: 1.2;
            margin: 0.25rem 0px 0px 0px;
            white-space: nowrap;
        }

        #information #more-information {
            display: flex;
            flex-direction: column;
            justify-content: center;
            font-size: 1.0rem;
        }

        #information #more-information mwc-icon-button {
            --mdc-icon-size: 2.0rem;
            --mdc-icon-font: 'Material Symbols Outlined';
        }
    `;

    private _playerController = new SyncedPlayerController(this, ["audiochange"]);
    
    coverTemplate(): TemplateResult {
        const player = this._playerController.player;
        if (player?.currentAudio) {
            const cover = player.currentAudio.cover;
            const src = URL.createObjectURL(new Blob([cover.data], { type: cover.format }));
            return html`<img id="cover" src="${src}" />`;
        } else {
            return html`<div class="add-audio" @click=${() => window.app.showDialog("add-audio-dialog")}>library_music</div>`;
        }
    }

    informationTemplate(): TemplateResult {
        const player = this._playerController.player;
        if (player?.currentAudio) {
            return html`
                <div id="title-and-album">
                    <h1>${player.currentAudio.title}</h1>
                    <h2>${player.currentAudio.album}</h2>
                </div>
                <div id="more-information">
                    <mwc-icon-button icon="info"></mwc-icon-button>
                </div>
            `
        } else {
            return html``;
        }
    }

    async updateTitleAnimation() {
        await this.updateComplete;
        setTimeout(() => {
            const titleElement = this.shadowRoot.querySelector("h1");
            if (titleElement) {
                const offsetWidth = titleElement.offsetWidth;
                const scrollWidth = titleElement.scrollWidth;
                const overflowWidth = scrollWidth - offsetWidth;
                const pxPerSecond = 10;
                const duration = overflowWidth / pxPerSecond;
                titleElement.style.setProperty("--overflow-width", `${overflowWidth}px`);
                titleElement.style.setProperty("--animation-duration", `${duration}s`);
                titleElement.style.animationPlayState = "running";
            }
        }, 100);
    }

    updated() {
        this.updateTitleAnimation();
    }

    render() {
        return html`
            <div id="cover">
                ${this.coverTemplate()}
            </div>
            <div id="information">
                ${this.informationTemplate()}
            </div>
        `;
    }
}

@customElement("player-timeline")
export class PlayerTimeline extends LitElement {
    static styles = css`
        :host {
            position: relative;
            display: block;
            padding: 0px var(--padding);
            z-index: 1;
        }

        :host::before {
            content: '';
            
        }

        mwc-slider {
            margin: 0px -24px;
        }

        mwc-slider::before {
            position: absolute;
            content: '';
            box-shadow: 0px 11px 15px -7px rgb(0 0 0 / 20%), 0px 24px 38px 3px rgb(0 0 0 / 14%), 0px 9px 46px 8px rgb(0 0 0 / 12%);
            z-index: -1;
        }

        .time {
            position: relative;
            top: -10px;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            font-size: calc(0.6rem + var(--maxified-player) * 0.2rem);
            height: 0.8rem;
            margin-bottom: -10px;
        }
    `;

    private _playerController = new SyncedPlayerController(this, ["timeupdate", "durationchange"]);

    render() {
        const player = this._playerController.player;
        const state = player?.state;
        const disabled = !player || !player.currentAudio;
        const duration = player?.currentAudio ? player.currentAudio.duration : 1.0;
        const currentTime = state ? state.playback.currentTime : 0.0;
        return html`
            <mwc-slider ?disabled=${disabled} @change=${(event: any) => player.seek(event.detail.value)} value="${disabled ? 0 : currentTime}" min="0" max="${duration}"></mwc-slider>
            <div class="time">
                <span id="current">${disabled ? nothing : prettyTime(currentTime)}</span>
                <span id="duration">${disabled ? nothing : prettyTime(duration)}</span>
            </div>
        `
    }
}

@customElement("player-controls")
export class PlayerControls extends LitElement {
    static styles = css`
        :host {
            display: block;
            padding: 0px var(--padding);
        }

        #controls-container {
            position: relative;
            height: 3.0rem;
        }

        #controls {
            position: absolute;
            display: flex;
            flex-direction: row;
            justify-content: flex-end;
            align-items: center;
            width: -moz-fit-content;
            width: fit-content;
            right: calc(var(--maxified-player) * 50%);
            transform: translateX(calc(var(--maxified-player) * 50%));
        }

        mwc-icon-button {
            --mdc-icon-size: 2.5rem;
            --mdc-icon-font: 'Material Symbols Outlined';
            margin: 0px calc(var(--maxified-player) * 0.25rem);
        }

        mwc-icon-button.play {
            --mdc-icon-size: calc(2.5rem + var(--maxified-player) * 1.5rem);
            margin: 0px calc(var(--maxified-player) * 0.75rem);
        }

        mwc-icon-button.only-maxified {
            opacity: calc((var(--maxified-player) - 0.5) * 2.0);
            width: calc(var(--maxified-player) * 3.0rem);
            transform: translateX(calc(-0.5 * var(--minified-player) * 3.0rem));
        }
    `;

    private _playerController = new SyncedPlayerController(this, ["play", "pause", "audiochange", "playlistchange"]);

    render() {
        const player = this._playerController.player;
        const state = player?.state;
        const disabled = !player || !player.currentAudio;
        const currentAudioIndex = (state && player.currentAudio) ? state.playlist.indexOf(player.currentAudio) : -1;
        return html`
            <div id="controls-container">
                <div id="controls">
                    <mwc-icon-button ?disabled=${disabled || currentAudioIndex === 0} @click=${() => player.skipPrevious()} icon="skip_previous"></mwc-icon-button>
                    <mwc-icon-button ?disabled=${disabled} @click=${() => player.replay()} icon="replay_30" class="only-maxified"></mwc-icon-button>
                    <mwc-icon-button ?disabled=${disabled} class="play" @click=${() => player.togglePlay()} icon="${!player || player.state.playback.paused ? "play_circle" : "pause_circle"}"></mwc-icon-button>
                    <mwc-icon-button ?disabled=${disabled} @click=${() => player.forward()} icon="forward_30" class="only-maxified"></mwc-icon-button>
                    <mwc-icon-button ?disabled=${disabled || currentAudioIndex === state.playlist.length - 1} @click=${() => player.skipNext()} icon="skip_next"></mwc-icon-button>
                </div>
            </div>
        `
    }
}


@customElement("synced-listeners")
export class SyncedListeners extends LitElement {
    static styles = css`
        :host {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            padding: 0px var(--padding);
        }

        #connected {
            display: flex;
            flex-direction: row;
        }

        #connected listener-avatar:not(:first-child) {
            margin-left: -0.75rem;
        }

        #invite-border {
            position: relative;
            height: 2.5rem;
            border-radius: 1.75rem;
            margin-left: -0.75rem;
            background: linear-gradient(25deg, var(--mdc-theme-primary), var(--mdc-theme-secondary));
        }

        #invite {
            box-sizing: border-box;
            display: flex;
            flex-direction: row;
            align-items: center;
            height: 100%;
            padding: 0px 1.0rem;
            border-radius: inherit;
            border: 1px solid transparent;
            background-color: var(--mdc-theme-background);
            background-clip: padding-box;
        }

        mwc-icon-button {
            --mdc-icon-button-size: 3.0rem;
            --mdc-icon-size: 1.5rem;
            opacity: calc(var(--maxified-player) * 1.0);
            width: calc(var(--maxified-player) * 3.0rem);
            transform: translateX(calc(-1 * var(--minified-player) * 3.0rem));
        }

        #invite span {
            margin-right: 0.5rem;
        }

        #invite span:last-child {
            margin-right: 0px;
        }

        #invite .icon {
            font-family: 'Material Symbols Outlined';
            font-size: 1.2rem;
        }

        #qr-code.icon {
            font-size: 1.5rem;
        }
    `;

    private _playerController = new SyncedPlayerController(this, ["listenerschange"]);

    inviteListener() {
        Share.canShare().then((canShare) => {
            if (canShare.value === true) {
                Share.share({
                    dialogTitle: "Invite listeners",
                    title: "Listen together with me!",
                    text: "I'd like to listen together with you 🎧 Come join me! 😊",
                    url: this._playerController.player.inviteLink
                });
            } else {
                window.app.showDialog("invite-listener-dialog");
            }
        });
    }

    render() {
        const listeners = this._playerController.player?.listeners || [];
        console.log(listeners);
        return html`
            <div id="connected">
                ${listeners.map(listener => html`
                    <listener-avatar id="${listener.id}" name="${listener.name}"></listener-avatar>
                `)}
                <div id="invite-border">
                    <div id="invite" @click=${this.inviteListener}>
                        <mwc-ripple></mwc-ripple>
                        <span class="icon">share</span>
                        <span>Invite!</span>
                        <!--<span class="icon" id="qr-code">qr_code_2</span>-->
                    </div>
                </div>
            </div>
            <mwc-icon-button unelevated icon="settings"></mwc-icon-button>
        `
    }
}

@customElement("editable-playlist")
export class EditablePlaylist extends LitElement {
    static styles = css`
        :host {
            display: block;
            padding: 0px var(--padding);
        }

        mwc-list {
            margin-left: -16px;
            margin-right: -16px;
        }

        mwc-list-item {
            box-sizing: border-box;
        }

        .currently-moving {
            visibility: hidden;
        }
    `;

    private _playerController = new SyncedPlayerController(this, ["play", "pause", "playlistchange", "audiochange"]);
    private _touch = {
        containerElement: null,
        listElements: [],
        element: null,
        clonedElement: null,
        offsetTopStart: 0,
        offsetHeight: 0,
        clientYStart: 0,
        url: "",
        deltaIndex: 0,
        deltaIndexMin: 0,
        deltaIndexMax: 0
    }

    touchStart = (event: TouchEvent, url: string) => {
        event.preventDefault();

        this._touch.containerElement = this.shadowRoot.querySelector("mwc-list");
        this._touch.containerElement.style.position = "relative";
        this._touch.listElements = Array.from(this._touch.containerElement.children);
        this._touch.element = event.composedPath().find((target: HTMLElement) => target.nodeName == "MWC-LIST-ITEM") as HTMLElement;
        this._touch.clonedElement = this._touch.element.cloneNode(true);
        this._touch.offsetTopStart = this._touch.element.offsetTop;
        this._touch.offsetHeight = this._touch.element.offsetHeight;
        this._touch.clonedElement.style.position = "absolute";
        this._touch.clonedElement.style.width = `${this._touch.element.offsetWidth}px`;
        this._touch.clonedElement.style.top = `${this._touch.offsetTopStart}px`;
        this._touch.containerElement.appendChild(this._touch.clonedElement);
        this._touch.element.classList.add("currently-moving");
        this._touch.clientYStart = event.changedTouches[0].clientY;

        this._touch.url = this._touch.element.dataset.url;
        let currentIndex = 0;
        for (const element of this._touch.listElements) {
            if (element === this._touch.element) {
                break;
            }
            currentIndex++;
        }
        this._touch.deltaIndex = 0;
        this._touch.deltaIndexMin = -currentIndex;
        this._touch.deltaIndexMax = this._touch.listElements.length - currentIndex - 1;
    }

    touchMove = (event: TouchEvent) => {
        if (this._touch.element !== null) {
            const movement = event.changedTouches[0].clientY - this._touch.clientYStart;
            const offsetTop = this._touch.offsetTopStart + movement;
            this._touch.clonedElement.style.top = `${offsetTop}px`;

            const oldDeltaIndex = this._touch.deltaIndex;
            this._touch.deltaIndex = Math.round(movement / this._touch.offsetHeight);
            this._touch.deltaIndex = clamp(Math.round(movement / this._touch.offsetHeight), this._touch.deltaIndexMin, this._touch.deltaIndexMax);
            if (this._touch.deltaIndex !== oldDeltaIndex) {
                if (this._touch.deltaIndex > oldDeltaIndex && this._touch.element.nextElementSibling) {
                    this._touch.element.nextElementSibling.after(this._touch.element);
                } else if (this._touch.element.previousElementSibling) {
                    this._touch.element.previousElementSibling.before(this._touch.element);
                }
            }
        }
    }

    touchEnd = (event: TouchEvent) => {
        if (this._touch.element !== null) {
            this._touch.clonedElement.remove();
            this._touch.element.classList.remove("currently-moving");

            this._playerController.player.moveAudio(this._touch.url, this._touch.deltaIndex);
        }
    }

    selectAudio(event: any) {
        console.log("selectAudio")
        const player = this._playerController.player;
        player.playAudio(event.detail.index);
    }

    render() {
        console.log("render")
        const player = this._playerController.player;
        const audios = player?.state.playlist || [];
        return html`
            <mwc-list activatable @selected=${this.selectAudio}>
                ${repeat(audios, (audio) => audio.url, (audio) => html`
                    <mwc-list-item ?activated=${audio.url == player.currentAudio.url} twoline graphic="medium" hasMeta>
                        <span>${audio.title}</span>
                        <span slot="secondary">${audio.album}</span>
                        <img slot="graphic" src="${audio.cover?.data &&  audio.cover?.format ? URL.createObjectURL(new Blob([audio.cover.data], { type: audio.cover.format })) : nothing}" />
                        <mwc-icon slot="meta" @touchstart=${(event: TouchEvent) => this.touchStart(event, audio.url)} @touchmove=${this.touchMove} @touchend=${this.touchEnd}>drag_indicator</mwc-icon>
                    </mwc-list-item>
                `)}
            </mwc-list>
        `;
    }
}

@customElement("audio-player")
export class AudioPlayer extends LitElement {
    static styles = css`
        :host {
            --cover-size: min(calc(100vw - 2.0rem), 55vh);
            --minified-player: 0.0;
            --maxified-player: 1.0;

            display: flex;
            flex-direction: column;
            width: calc(var(--cover-size) + 2 * var(--padding));
            height: 100%;
            padding: var(--padding) 0px;
            color: var(--mdc-theme-on-background);
        }

        #content {
            flex-grow: 1;
            overflow-y: scroll;
            overflow-x: hidden;
            scroll-snap-type: y mandatory;
            scrollbar-width: none;
        }

        #content::-webkit-scrollbar {
            display: none;
        }

        #content cover-and-information {
            height: 100%;
            scroll-snap-align: start;
        }

        #content editable-playlist {
            min-height: 100%;
            scroll-snap-align: start;
        }

        player-timeline {
            transform: translateY(calc(var(--minified-player) * var(--synced-listeners-height)));
        }

        player-controls {
            transform: translateY(calc(var(--minified-player) * var(--synced-listeners-height)));
        }

        synced-listeners {
            padding-top: 2.0rem;
        }
    `;

    private _playerController = new SyncedPlayerController(this, ["playlistchange"]);

    contentScroll(): void {
        const syncedListenersElement = this.shadowRoot.querySelector("synced-listeners") as HTMLElement;
        this.style.setProperty("--synced-listeners-height", `${syncedListenersElement.offsetHeight}px`);

        const contentElement = this.shadowRoot.querySelector("#content") as HTMLElement;
        const scrollPercentage = Math.min(1.0, (contentElement.scrollTop / contentElement.offsetHeight));
        this.style.setProperty("--minified-player", `${scrollPercentage}`);
        this.style.setProperty("--maxified-player", `${-1 * (scrollPercentage - 1)}`);
    }

    render() {
        return html`
            <div id="content" @scroll=${this.contentScroll}>
                <cover-and-information></cover-and-information>
                ${this._playerController.player?.state?.playlist.length > 0 ? html`<editable-playlist></editable-playlist>` : nothing}
            </div>
            <div id="controls">
                <player-timeline></player-timeline>
                <player-controls></player-controls>
                <synced-listeners></synced-listeners>
            </div>
        `
    }
}