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
        "podcast-subscriptions": PodcastSubscriptions;
    }
}

@customElement("podcast-subscriptions")
export class PodcastSubscriptions extends AppPage {
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
        `
    ];

    title = "Subscriptions";
    icon = "podcasts";
    topAppBar = "small";

    @query("mwc-list")
    private playlistElement: HTMLElement;

    @query("mwc-menu")
    private menuElement: any;

    render() {
        const podcasts = [
            {
                title: "Foo"
            },
            {
                title: "Bar"
            },
        ]

        return html`
            <mwc-list noninteractive>
                ${repeat(podcasts, (podcast) => podcast.title, (podcast) => html`
                    <mwc-list-item twoline graphic="medium" hasMeta>
                        <span>${podcast.title}</span>
                        <span slot="secondary"></span>
                        <img slot="graphic" src="${defaultCoverObjectUrl}" />
                    </mwc-list-item>
                `)}
            </mwc-list>
        `;
    }
}
