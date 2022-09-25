import { LitElement, html, css } from "lit";
import { customElement, query, queryAssignedElements, state } from "lit/decorators";

import { ModalDialog } from "./dialogs/modal_dialog";
import { AppMenu } from "./menu";
import { AppPage } from "./pages/page";

declare global {
    interface HTMLElementTagNameMap {
        "listen-together-app": ListenTogetherApp;
    }
}

@customElement("listen-together-app")
export class ListenTogetherApp extends LitElement {
    static styles = css`
        #app-content {
            --height: 100vh;
            --height: calc(var(--svh) * 100);
            --top-app-bar-height: 4.0rem;

            width: 100vw;
            height: var(--height);
        }

        #top-app-bar {
            position: relative;
            box-sizing: border-box;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            width: 100vw;
            height: var(--top-app-bar-height);
            padding: 0px 0.25rem 0px 0.25rem;
            background-color: var(--surface);
            color: var(--on-surface);
        }

        #top-app-bar::before {
            content: '';
            position: absolute;
            top: 0px;
            left: 0px;
            width: 100%;
            height: 100%;
            opacity: 0.0;
            background-color: var(--primary);
            transition: 300ms opacity;
        }

        .scrolled #top-app-bar::before,
        #top-app-bar.small::before {
            opacity: 0.08;
        }

        #top-app-bar mwc-icon-button {
            --mdc-icon-size: 1.5rem;
            --mdc-icon-button-size: 3.0rem;
        }

        #top-app-bar h1 {
            font-size: 1.375rem;
            font-weight: 400;
        }

        #top-app-bar.small h1 {
            flex-grow: 1;
            padding-left: 0.25rem;
        }

        #top-app-bar.no-title h1 {
            display: none;
        }

        #top-app-bar .actions mwc-icon-button {
            color: var(--on-surface-variant);
        }

        #app-pages {
            width: 100vw;
            height: calc(var(--height) - var(--top-app-bar-height));
            overflow-y: scroll;
            overflow-x: hidden;
            scroll-snap-type: y mandatory;
            scrollbar-width: none;
        }

        #app-pages::-webkit-scrollbar {
            display: none;
        }

        #app-dialogs {
            z-index: 0;
        }
    `;

    @state()
    private currentPageTitle: string = "";

    @state()
    private currentPage: AppPage | null = null;

    @state()
    private topAppBarClass: string = "";

    @query("#app-pages", true)
    private appPagesElement: HTMLElement;

    @query("app-menu")
    private appMenuElement: AppMenu;

    @queryAssignedElements({ slot: "page" })
    private pages: Array<AppPage>;

    @queryAssignedElements({ slot: "dialog" })
    private dialogs: Array<ModalDialog>;

    showDialog(tagName: string) {
        const requestedDialog = this.dialogs.find((dialog: ModalDialog) => dialog.tagName.toLowerCase() === tagName.toLowerCase());
        if (requestedDialog) {
            for (const dialog of this.dialogs) {
                if (dialog !== requestedDialog) {
                    dialog.hide();
                }
            }
            requestedDialog.show();
        }
    }

    private pageScroll(): void {
        if (this.pages.length > 1) {
            const firstPage = this.pages[0];
            const scrollPercentage = Math.min(1.0, (this.appPagesElement.scrollTop / firstPage.offsetHeight));
            document.body.style.setProperty("--minified-controls", `${scrollPercentage}`);
            document.body.style.setProperty("--maxified-controls", `${-1.0 * (scrollPercentage - 1.0)}`);

            if (scrollPercentage > 0.95) {
                document.body.setAttribute("minified-controls", "true");
                this.currentPage = this.pages[1];
                this.currentPageTitle = this.pages[1].title;
                this.topAppBarClass = this.pages[1].topAppBar;
            } else {
                document.body.setAttribute("minified-controls", "false");
                this.currentPage = this.pages[0];
                this.currentPageTitle = this.pages[0].title;
                this.topAppBarClass = this.pages[0].topAppBar;
            }
        }
    }

    private menuAction(event: any) {
        this.pages[event.detail.index].scrollIntoView();
        this.appMenuElement.hide();
    }

    render() {
        return html`
            <div id="app-content">
                <div id="top-app-bar" class="${this.topAppBarClass}">
                    <mwc-icon-button icon="menu" @click=${() => this.appMenuElement.show()}></mwc-icon-button>
                    <h1>${this.currentPageTitle}</h1>
                    <div class="actions">
                    </div>
                </div>
                <div id="app-pages" @scroll=${this.pageScroll}>
                    <slot name="page" @slotchange=${() => this.requestUpdate()}></slot>
                </div>
            </div>
            <session-controls></session-controls>
            <div id="app-dialogs">
                <slot name="dialog"></slot>
            </div>
            <app-menu @action=${this.menuAction}>
                ${this.pages.map(page => html`
                    <mwc-list-item ?selected=${page === this.currentPage} ?activated=${page === this.currentPage} graphic="medium" slot="entry">
                        <span>${page.title}</span>
                        <mwc-icon slot="graphic">${page.icon}</mwc-icon>
                    </mwc-list-item>
                `)}
            </app-menu>
        `
    }
}