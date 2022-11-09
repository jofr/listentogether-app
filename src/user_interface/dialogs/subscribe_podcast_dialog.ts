import { html, css } from "lit";
import { repeat } from "lit/directives/repeat";
import { customElement, eventOptions, state } from "lit/decorators";

import { AddMediaDialog } from "./add_media_dialog";
import { AudioInfo, PodcastInfo } from "../../metadata/types";
import { extractUrls } from "../../util/util";
import { SessionController } from "../controllers/session";
import { defaultCoverObjectUrl, transparentDefaultCoverObjectUrl } from "../../util/util";

declare global {
    interface HTMLElementTagNameMap {
        "subscribe-podcast-dialog": AddAudioDialog;
    }
}

@customElement("subscribe-podcast-dialog")
export class AddAudioDialog extends AddMediaDialog {
    static styles = [
        AddMediaDialog.styles,
        css`
            .podcast-header {
                display: flex;
                flex-direction: row;
                gap: var(--title-padding);
            }

            .podcast-header img {
                width: 25vw;
                height: 25vw;
            }

            .podcast-info {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                font-size: 0.875rem;
                overflow: hidden;
            }

            .podcast-info h1 {
                padding: 0px;
                margin: 0px;
                font-size: 1.0rem;
                font-weight: 600;
                line-height: 1.5rem;
            }

            .additional-info {
                display: flex;
                flex-flow: row nowrap;
            }

            .additional-info mwc-icon {
                --mdc-icon-size: 0.875rem;
            }

            .additional-info span {
                white-space: nowrap;
            }
        `
    ];

    @state()
    private selectedPodcast: PodcastInfo | null = null;

    private inputTimeout: number | null = null;

    @eventOptions({passive: true})
    async getMorePossiblePodcasts(event: Event) {
        const element = event.target as HTMLElement;
        if (element.scrollTop > (element.scrollHeight - element.clientHeight - 25)) {
            this.loadingMore = true;

            this.possiblePodcasts = this.allPossiblePodcasts.slice(0, this.possiblePodcasts.length + 10);

            this.loadingMore = false;
        }
    }

    private onInput(event: Event) {
        const input = (event.target as HTMLInputElement).value;

        if (this.inputTimeout !== null) {
            clearTimeout(this.inputTimeout);
        }
        this.inputTimeout = window.setTimeout(async () => {
            this.getPossiblePodcastsFromSearchQuery(input);
        }, 250);
    }

    private subscribeToSelectedPodcast() {
        // TODO

        this.hide();
    }

    hide() {
        super.hide();

        this.selectedPodcast = null;
    }

    renderContent() {
        if (this.selectedPodcast !== null) {
            const podcast = this.selectedPodcast;
            return html`
                <div class="podcast-header">
                <img src=${podcast.cover?.thumbnail?.url ? podcast.cover.thumbnail.url : defaultCoverObjectUrl}"
                     style="background-image: url('${transparentDefaultCoverObjectUrl}');"
                     onerror="this.src='${defaultCoverObjectUrl}'" />
                     <div class="podcast-info">
                        <h1>${podcast.title}</h1>
                        <div class="additional-info">
                            <mwc-icon>rss_feed</mwc-icon>
                            <span>${podcast.artist}</span>
                        </div>
                    </div>
                </div>
                <p>${podcast.description}</p>
            `;
        } else {
            return html`
                <mwc-textfield outlined label="Search podcasts" @input=${this.onInput}></mwc-textfield>
                <mwc-circular-progress-four-color indeterminate ?hidden=${this.possiblePodcasts.length !== 0 || !this.processing}></mwc-circular-progress-four-color>
                <mwc-list ?hidden=${this.possiblePodcasts.length === 0} @scroll=${this.getMorePossiblePodcasts}>
                    ${repeat(this.possiblePodcasts, podcast => podcast.uri, podcast => html`
                        <mwc-list-item twoline graphic="medium" @click=${() => { this.selectedPodcast = podcast; window.backButton.push(() => { this.selectedPodcast = null }); }}>
                            <span>${podcast.title}</span>
                            <span slot="secondary">${podcast.artist}</span>
                            <img slot="graphic"
                                 src="${podcast.cover?.thumbnail?.url ? podcast.cover.thumbnail.url : defaultCoverObjectUrl}"
                                 style="background-image: url('${transparentDefaultCoverObjectUrl}');"
                                 onerror="this.src='${defaultCoverObjectUrl}'" />
                        </mwc-list-item>
                    `)}
                </mwc-list>
            `
        }
    }

    renderActions() {
        return html`
            <mwc-button label="Cancel" @click=${this.hide}></mwc-button>
            <mwc-button ?disabled=${this.selectedPodcast === null} unelevated icon="rss_feed" label="Subscribe" @click=${this.subscribeToSelectedPodcast}></mwc-button>
        `;
    }
}