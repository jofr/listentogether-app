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
        "add-audio-dialog": AddAudioDialog;
    }
}

@customElement("add-audio-dialog")
export class AddAudioDialog extends AddMediaDialog {
    private autoSelectAllAudios: boolean = true;
    private inputTimeout: number | null = null;
    private sessionController = new SessionController(this);

    @eventOptions({passive: true})
    async getMorePossibleAudios(event: Event) {
        if (this.moreAudiosPossible === false || this.loadingMore) {
            return;
        }

        const element = event.target as HTMLElement;
        if (element.scrollTop > (element.scrollHeight - element.clientHeight - 25)) {
            this.loadingMore = true;

            await this.loadMorePossibleAudiosFromPodcast();

            this.loadingMore = false;
        }
    }

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
        const urls = extractUrls(input);

        if (urls !== null) {
            this.autoSelectAllAudios = true;
            this.getPossibleAudiosFromUrls(urls);
        } else {
            if (this.inputTimeout !== null) {
                clearTimeout(this.inputTimeout);
            }
            this.inputTimeout = window.setTimeout(async () => {
                this.getPossiblePodcastsFromSearchQuery(input);
            }, 250);
        }
    }

    private addSelectedAudiosToPlaylist() {
        const selectedIndices = this.shadowRoot.querySelector("mwc-list").index as Set<number>;
        if (this.possibleAudios && this.sessionController.session) {
            for (let i = 0; i < this.possibleAudios.length; i++) {
                if (selectedIndices.has(i)) {
                    this.sessionController.session.addAudio(this.possibleAudios[i].uri);
                }
            }
        }

        this.hide();
    }

    renderContent() {
        if (this.possibleAudios.length > 0) {
            return html`
                <mwc-list multi @scroll=${this.getMorePossibleAudios}>
                    ${repeat(this.possibleAudios, audio => audio.uri, audio => html`
                        <mwc-check-list-item ?selected=${this.autoSelectAllAudios} twoline graphic="medium">
                            <span>${audio.title}</span>
                            <span slot="secondary">${audio.album}</span>
                            <img slot="graphic"
                                 src="${audio.cover?.thumbnail?.url ? audio.cover.thumbnail.url : defaultCoverObjectUrl}"
                                 style="background-image: url('${transparentDefaultCoverObjectUrl}');"
                                 onerror="this.src='${defaultCoverObjectUrl}'" />
                        </mwc-check-list-item>
                    `)}
                </mwc-list>
                <mwc-linear-progress indeterminate ?hidden=${!this.loadingMore}></mwc-linear-progress>
            `;
        } else {
            return html`
                <mwc-textfield outlined label="Search podcasts or paste audio URLs" @input=${this.onInput}></mwc-textfield>
                <mwc-circular-progress-four-color indeterminate ?hidden=${this.possiblePodcasts.length !== 0 || !this.processing}></mwc-circular-progress-four-color>
                <mwc-list ?hidden=${this.possiblePodcasts.length === 0} @scroll=${this.getMorePossiblePodcasts}>
                    ${repeat(this.possiblePodcasts, podcast => podcast.uri, podcast => html`
                        <mwc-list-item twoline graphic="medium" @click=${() => { this.autoSelectAllAudios = false; this.getPossibleAudiosFromPodcast(podcast.uri); window.backButton.push(() => { this.possibleAudios = [] }); }}>
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
            <mwc-button ?disabled=${this.possibleAudios.length === 0} unelevated icon="queue_music" label="Add to playlist" @click=${this.addSelectedAudiosToPlaylist}></mwc-button>
        `;
    }
}