import { html, css } from "lit";
import { customElement, query } from "lit/decorators";
import { repeat } from "lit/directives/repeat";
import { until } from 'lit/directives/until';

import { ListeningHost } from "../../listening/peer";
import { SessionController } from "../controllers/session";
import { SyncableListeningState } from "../../listening/state";
import { ListeningState } from "../../listening/state";
import { clamp, defaultCoverObjectUrl } from "../../util/util";
import { AppPage } from "./page";

declare global {
    interface HTMLElementTagNameMap {
        "editable-playlist": EditablePlaylist;
    }
}

@customElement("editable-playlist")
export class EditablePlaylist extends AppPage {
    static styles = [
        AppPage.styles,
        css`
            :host {
                --min-height: 100%;

                display: flex;
                flex-direction: column;
                min-height: var(--min-height);
            }

            mwc-list {
                --mdc-theme-on-surface: var(--on-surface);
                --mdc-theme-text-primary-on-background: var(--on-surface);
                --mdc-theme-text-secondary-on-background: var(--on-surface-variant);
                --mdc-theme-text-icon-on-background: var(--on-surface-variant);
                --mdc-theme-text-hint-on-background: var(--on-surface-variant);

                position: relative;
                margin: 0px -1.0rem 0px -1.0rem;
            }

            mwc-list > mwc-list-item {
                box-sizing: border-box;
                border-bottom: 1px solid var(--on-surface-opacity-12);
            }

            .currently-dragged {
                visibility: hidden;
            }
        `
    ];

    title = "Playlist";
    icon = "queue_music";
    topAppBar = "small";

    @query("mwc-list")
    private playlistElement: HTMLElement;

    @query("mwc-menu")
    private menuElement: any;

    private touchState = {
        element: null,
        draggedElement: null,
        topStart: 0,
        yStart: 0,
        deltaIndex: 0,
        deltaIndexMin: 0,
        deltaIndexMax: 0
    }

    private menuState = {
        audioElement: null
    }

    private sessionController = new SessionController(this, { subscribe: ["playlist"], listen: ["play", "pause", "audiochange"] });

    private selectAudio(uri: string) {
        const audioElements = Array.from(this.playlistElement.querySelectorAll(":scope > mwc-list-item"));
        const audioElement = audioElements.filter((element: HTMLElement) => element.dataset.uri === uri)[0];

        this.menuState.audioElement = audioElement;
        this.menuElement.anchor = audioElement;
        this.menuElement.show();
    }

    private playAudioNow() {
        if (this.menuState.audioElement !== null) {
            this.sessionController.session.playAudio(this.menuState.audioElement.dataset.uri);
        }
        this.menuElement.close();
    }
    
    private removeAudio() {
        if (this.menuState.audioElement !== null) {
            this.sessionController.session.removeAudio(this.menuState.audioElement.dataset.uri);
        }
        this.menuElement.close();
    }

    private touchStart(event: TouchEvent) {
        event.preventDefault();

        const element = event.composedPath().find((target: HTMLElement) => target.nodeName === "MWC-LIST-ITEM") as HTMLElement;
        this.touchState.element = element;

        const draggedElement = element.cloneNode(true) as HTMLElement;
        draggedElement.style.position = "absolute";
        draggedElement.style.width = `${element.offsetWidth}px`;
        this.touchState.topStart = element.offsetTop;
        draggedElement.style.top = `${this.touchState.topStart}px`;
        this.playlistElement.appendChild(draggedElement);
        this.touchState.draggedElement = draggedElement;

        this.touchState.element.classList.add("currently-dragged");
        this.touchState.yStart = event.changedTouches[0].clientY;

        let currentIndex = 0;
        for (const child of Array.from(this.playlistElement.querySelectorAll(":scope > mwc-list-item"))) {
            if (element === child) {
                break;
            }
            currentIndex++;
        }
        this.touchState.deltaIndex = 0;
        this.touchState.deltaIndexMin = -currentIndex;
        this.touchState.deltaIndexMax = this.sessionController.session.playlist.length - currentIndex - 1;
    }

    private touchMove(event: TouchEvent) {
        if (this.touchState.draggedElement === null) {
            return;
        }

        const yMovement = event.changedTouches[0].clientY - this.touchState.yStart;
        this.touchState.draggedElement.style.top = `${this.touchState.topStart + yMovement}px`;

        const oldDeltaIndex = this.touchState.deltaIndex;
        this.touchState.deltaIndex = clamp(Math.round(yMovement / this.touchState.element.offsetHeight), this.touchState.deltaIndexMin, this.touchState.deltaIndexMax);
        if (this.touchState.deltaIndex !== oldDeltaIndex) {
            if (this.touchState.deltaIndex > oldDeltaIndex && this.touchState.element.nextElementSibling) {
                this.touchState.element.nextElementSibling.after(this.touchState.element);
            } else if (this.touchState.element.previousElementSibling) {
                this.touchState.element.previousElementSibling.before(this.touchState.element)
            }
        }
    }

    private touchEnd() {
        if (this.touchState.draggedElement === null) {
            return;
        }

        this.touchState.draggedElement.remove();
        this.touchState.element.classList.remove("currently-dragged");
        this.touchState.draggedElement = null;

        const elements = Array.from(this.playlistElement.querySelectorAll(":scope > mwc-list-item")) as HTMLElement[];
        const playlist = elements.map(element => element.dataset.uri);
        (this.sessionController.session.listeningState as SyncableListeningState).applyLocalChange((state: ListeningState) => {
            state.playlist = playlist;
        });
    }

    render() {
        const session = this.sessionController.session;
        const audios = session?.playlist || [];
        const editable = (session?.listeningPeer && session.listeningPeer instanceof ListeningHost);

        if (editable) {
            return html`
                <mwc-list @touchmove=${this.touchMove} @touchend=${this.touchEnd}>
                    ${repeat(audios, (audio) => audio.uri, (audio) => html`
                        <mwc-list-item @click=${() => { this.selectAudio(audio.uri) }} ?activated=${audio.uri == session.playback.currentAudio} ?selected=${audio.uri == session.playback.currentAudio} twoline graphic="medium" hasMeta data-uri="${audio.uri}">
                            <span>${until(audio.title, html`<loading-placeholder characters="15"></loading-placeholder>`)}</span>
                            <span slot="secondary">${until(audio.album, html`<loading-placeholder characters="10"></loading-placeholder>`)}</span>
                            <img slot="graphic" src="${until(audio.cover.thumbnail.then(thumbnail => thumbnail.url ? thumbnail.url : defaultCoverObjectUrl), defaultCoverObjectUrl)}" />
                            <mwc-icon slot="meta" @touchstart=${(event: TouchEvent) => this.touchStart(event)}>drag_indicator</mwc-icon>
                        </mwc-list-item>
                    `)}
                    <mwc-menu id="menu" absolute="true">
                        <mwc-list-item graphic="icon" @click=${this.playAudioNow}>
                            <mwc-icon slot="graphic">play_arrow</mwc-icon>
                            Play now
                        </mwc-list-item>
                        <mwc-list-item graphic="icon" @click=${this.removeAudio}>
                            <mwc-icon slot="graphic">delete</mwc-icon>
                            Remove
                        </mwc-list-item>
                    </mwc-menu>
                </mwc-list>
            `;
        } else {
            return html`
                <mwc-list noninteractive>
                    ${repeat(audios, (audio) => audio.uri, (audio) => html`
                        <mwc-list-item ?activated=${audio.uri == session.playback.currentAudio} twoline graphic="medium" hasMeta data-uri="${audio.uri}">
                            <span>${until(audio.title, html`<loading-placeholder characters="15"></loading-placeholder>`)}</span>
                            <span slot="secondary">${until(audio.album, html`<loading-placeholder characters="10"></loading-placeholder>`)}</span>
                            <img slot="graphic" src="${until(audio.cover.thumbnail.then(thumbnail => thumbnail.url ? thumbnail.url : defaultCoverObjectUrl), defaultCoverObjectUrl)}" />
                        </mwc-list-item>
                    `)}
                </mwc-list>
            `;
        }
    }
}
