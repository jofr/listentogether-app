import { html, css, TemplateResult } from "lit";
import { customElement } from "lit/decorators";
import { until } from 'lit/directives/until.js';

import { SessionController } from "../controllers/session";
import { defaultCoverObjectUrl } from "../../util/util";
import { AppPage } from "./page";

declare global {
    interface HTMLElementTagNameMap {
        "now-playing": NowPlaying;
    }
}

@customElement("now-playing")
export class NowPlaying extends AppPage {
    static styles = [
        AppPage.styles,
        css`
            :host {
                --cover-size: min(calc(100vw - 2 * var(--content-padding)), calc(50 * var(--svh)));

                display: flex;
                flex-direction: column;
                justify-content: center;
                height: calc(100% - 12.5rem);
            }

            #cover {
                width: var(--cover-size);
                height: var(--cover-size);
                margin: 0px auto;
                border-radius: 0.75rem;
                overflow: hidden;
            }

            #cover img {
                width: 100%;
                background-color: #b0e7ae;
            }

            #cover .add-audio {
                width: var(--cover-size);
                height: var(--cover-size);
                font-family: 'Material Symbols Outlined';
                font-size: max(12.0rem, calc(var(--cover-size) - 10.0rem));
                line-height: var(--cover-size);
                text-align: center;
                color: var(--mdc-theme-on-primary);
                color: #b0e7ae;
            }

            #information {
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
                text-align: left;
                margin-top: 0.75rem;
                margin-left: auto;
                margin-right: auto;
                width: var(--cover-size);
            }

            #information #title-and-album {
                overflow: hidden;
                min-height: 3.0rem;
                color: var(--on-surface);
            }

            #information #title-and-album h1 {
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

            #information #title-and-album h2 {
                font-size: 1.0rem;
                font-weight: normal;
                line-height: 1.2;
                margin: 0.25rem 0px 0px 0px;
                white-space: nowrap;
            }

            mwc-icon-button {
                --mdc-icon-size: 1.5rem;
                --mdc-icon-button-size: 3.0rem;
                color: var(--on-surface-variant);
            }
        `
    ];

    title = "Now listening";
    icon = "play_arrow";
    topAppBar = "no-title";

    private sessionController = new SessionController(this, { listen: ["audiochange"] });
    
    coverTemplate(): TemplateResult {
        const session = this.sessionController.session;

        if (session?.currentAudio) {
            return html`<img id="cover" src="${until(window.metadataCache.getAudioInfo(session.currentAudio.uri).then(audio => audio.cover?.url ? audio.cover.url : defaultCoverObjectUrl), defaultCoverObjectUrl)}" />`;
        } else {
            return html`<div class="add-audio" @click=${() => window.app.showDialog("add-audio-dialog")}>playlist_add</div>`;
        }
    }

    informationTemplate(): TemplateResult {
        const session = this.sessionController.session;

        if (session?.currentAudio) {
            const currentAudio = session.currentAudio;

            return html`
                <div id="title-and-album">
                    <h1>${until(window.metadataCache.getAudioInfo(currentAudio.uri).then(audio => audio.title), html`<loading-placeholder characters="10"></loading-placeholder>`)}</h1>
                    <h2>${until(window.metadataCache.getAudioInfo(currentAudio.uri).then(audio => audio.album), html`<loading-placeholder characters="10"></loading-placeholder>`)}</h2>
                </div>
                <!--<mwc-icon-button id="more-information" icon="info"></mwc-icon-button>-->
            `
        } else {
            return html``;
        }
    }

    /* Reset animation, calculate new animation properties and start after 5 seconds */
    async updateTitleAnimation() {
        const titleElement = this.shadowRoot.querySelector("h1");
        if (titleElement) {
            titleElement.style.animation = "none";
            setTimeout(() => {
                titleElement.style.animation = "";
                const offsetWidth = titleElement.offsetWidth;
                const scrollWidth = titleElement.scrollWidth;
                const overflowWidth = scrollWidth - offsetWidth;
                const pxPerSecond = 10;
                const duration = overflowWidth / pxPerSecond;
                titleElement.style.setProperty("--overflow-width", `${overflowWidth}px`);
                titleElement.style.setProperty("--animation-duration", `${duration}s`);
                titleElement.style.animationPlayState = "running";
            }, 5000);
        }
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