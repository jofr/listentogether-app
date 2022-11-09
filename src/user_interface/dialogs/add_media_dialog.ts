import { css } from "lit";
import { state } from "lit/decorators";

import { ModalDialog } from "./modal_dialog";
import { AudioInfo, PodcastInfo } from "../../metadata/types";

export class AddMediaDialog extends ModalDialog {
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
    protected possiblePodcasts: PodcastInfo[] = [];

    protected allPossiblePodcasts: PodcastInfo[] = [];

    @state()
    protected possibleAudios: AudioInfo[] = [];

    protected numberOfAudios: number = 0;
    protected moreAudiosPossible: boolean = false;
    protected podcastUrl: string;

    @state()
    protected processing: boolean = false;

    @state()
    protected loadingMore: boolean = false;

    async getPossibleAudiosFromUrls(urls: string[]) {
        this.processing = true;

        this.possibleAudios = await Promise.all(urls.map(url => window.metadataCache.getAudioInfo(url))) as AudioInfo[];
        this.moreAudiosPossible = false;

        this.processing = false;
    }

    async getPossibleAudiosFromPodcast(url: string) {
        this.processing = true;

        this.podcastUrl = url;
        this.numberOfAudios = 0;
        await this.loadMorePossibleAudiosFromPodcast();

        this.processing = false;
    }

    async loadMorePossibleAudiosFromPodcast() {
        this.possibleAudios = await window.metadataCache.getPodcastEpisodes(this.podcastUrl, 0, this.numberOfAudios + 10);
        if (this.possibleAudios.length == this.numberOfAudios + 10) {
            this.moreAudiosPossible = true;
        } else {
            this.moreAudiosPossible = false;
        }
        this.numberOfAudios = this.possibleAudios.length;
    }

    async getPossiblePodcastsFromSearchQuery(query: string) {
        this.processing = true;

        this.allPossiblePodcasts = await window.metadataCache.searchPodcasts(query);
        this.possiblePodcasts = this.allPossiblePodcasts.slice(0, 10);

        this.processing = false;
    }

    hide() {
        super.hide();

        this.possiblePodcasts = [];
        this.allPossiblePodcasts = [];

        this.possibleAudios = [];
        this.numberOfAudios = 0;
        this.moreAudiosPossible = false;
    }
}