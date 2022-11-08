import { html, css } from "lit";
import { repeat } from "lit/directives/repeat";
import { customElement, eventOptions, state } from "lit/decorators";

import { ModalDialog } from "./modal_dialog";
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
export class AddAudioDialog extends ModalDialog {
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

            mwc-textfield {
                --mdc-text-field-label-ink-color: var(--on-surface-variant);
                --mdc-text-field-ink-color: var(--on-surface);
                --mdc-text-field-outlined-idle-border-color: var(--outline);
                --mdc-text-field-outlined-hover-border-color: var(--on-surface);
            }

            mwc-button {
                --mdc-button-disabled-fill-color: var(--on-surface-opacity-12);
                --mdc-button-disabled-ink-color: var(--on-surface-opacity-38);
                --mdc-theme-primary: var(--primary);
                --mdc-theme-on-primary: var(--on-primary);
            }

            img {
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

            [hidden] {
                display: none;
            }
        `
    ];

    @state()
    private possiblePodcasts: PodcastInfo[] = [];

    private allPossiblePodcasts: PodcastInfo[] = [];

    @state()
    private possibleAudios: AudioInfo[] = [];

    private numberOfAudios: number = 0;
    private moreAudiosPossible: boolean = false;
    private podcastUrl: string;

    @state()
    private processing: boolean = false;

    @state()
    private loadingMore: boolean = false;

    private autoSelectAllAudios: boolean = true;

    private inputTimeout: number | null = null;

    private sessionController = new SessionController(this);

    async getPossibleAudiosFromUrls(urls: string[]) {
        this.processing = true;

        this.autoSelectAllAudios = true;
        this.possibleAudios = await Promise.all(urls.map(url => window.metadataCache.getAudioInfo(url))) as AudioInfo[];
        this.moreAudiosPossible = false;

        this.processing = false;
    }

    async getPossibleAudiosFromPodcast(url: string) {
        window.backButton.push(() => { this.possibleAudios = [] });

        this.processing = true;

        this.podcastUrl = url;
        this.autoSelectAllAudios = false;
        this.numberOfAudios = 0;
        await this.loadMorePossibleAudiosFromPodcast();


        this.processing = false;
    }

    async loadMorePossibleAudiosFromPodcast() {
        this.possibleAudios = await window.metadataCache.getPodcastEpisodes(this.podcastUrl, 0, this.numberOfAudios + 20);
        if (this.possibleAudios.length == this.numberOfAudios + 20) {
            this.moreAudiosPossible = true;
        } else {
            this.moreAudiosPossible = false;
        }
        this.numberOfAudios = this.possibleAudios.length;
    }

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

    async getPossiblePodcastsFromSearchQuery(query: string) {
        this.processing = true;

        this.allPossiblePodcasts = await window.metadataCache.searchPodcasts(query);
        this.possiblePodcasts = this.allPossiblePodcasts.slice(0, 10);

        this.processing = false;
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

    hide() {
        super.hide();

        this.allPossiblePodcasts = [];
        this.possiblePodcasts = [];
        this.possibleAudios = [];
        this.numberOfAudios = 0;
        this.moreAudiosPossible = false;
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
                        <mwc-list-item twoline graphic="medium" @click=${() => this.getPossibleAudiosFromPodcast(podcast.uri)}>
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