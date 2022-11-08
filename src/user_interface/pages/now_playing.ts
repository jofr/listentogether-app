import { html, css, TemplateResult } from "lit";
import { customElement } from "lit/decorators";
import { until } from 'lit/directives/until';
import { keyed } from 'lit/directives/keyed';

import { SessionController } from "../controllers/session";
import { defaultCoverObjectUrl, transparentDefaultCoverObjectUrl } from "../../util/util";
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
                animation: fading 1.5s infinite;
                background-size: cover;
            }

            @keyframes fading {
                0% {
                    background-color: rgba(var(--on-surface-rgb), .1);
                }
                
                50% {
                    background-color: rgba(var(--on-surface-rgb), .2);
                }
                
                100% {
                    background-color: rgba(var(--on-surface-rgb), .1);
                }
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
                cursor: pointer;
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

        // If e.g. skipping to the next song the cover image gets obviously
        // changed. Normally this would reuse the img element. But if we are on
        // a slow connection this results in the old cover image still being
        // visible until the new cover image is loaded (because the img element
        // is reused and just the src changed). Using keyed() makes sure that a
        // new img element is created every time (which starts with a
        // transparent image so that the loading animation is visible until the
        // cover image is loaded)
        if (session?.playback.currentAudio) {
            return html`
                ${keyed(session.playback.currentAudio, 
                        html`<img id="cover"
                                  src="${until(window.metadataCache.getAudioInfo(session.playback.currentAudio).then(audio => audio.cover?.large?.url ? audio.cover.large.url : defaultCoverObjectUrl), "data:image/svg+xml;charset=utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E")}"
                                  style="background-image: url('${transparentDefaultCoverObjectUrl}');"
                                  onerror="this.src='${defaultCoverObjectUrl}'"/>`)}
            `;
        } else {
            return html`<div class="add-audio" @click=${() => window.app.showDialog("add-audio-dialog")}>playlist_add</div>`;
        }
    }

    informationTemplate(): TemplateResult {
        const session = this.sessionController.session;

        if (session?.playback.currentAudio) {
            const currentAudio = session.playback.currentAudio;

            return html`
                <div id="title-and-album">
                    <h1>${until(window.metadataCache.getAudioInfo(currentAudio).then(audio => audio.title), html`<loading-placeholder characters="10"></loading-placeholder>`)}</h1>
                    <h2>${until(window.metadataCache.getAudioInfo(currentAudio).then(audio => audio.album), html`<loading-placeholder characters="10"></loading-placeholder>`)}</h2>
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