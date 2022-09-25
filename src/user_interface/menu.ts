import { LitElement, html, css, CSSResultGroup } from "lit";
import { customElement, state } from "lit/decorators";
import { classMap } from "lit/directives/class-map";

@customElement("app-menu")
export class AppMenu extends LitElement {
    static styles = css`
        aside {
            box-sizing: border-box;
            position: fixed;
            top: 0px;
            left: 0px;
            bottom: 0px;
            width: 20.0rem;
            padding: 0.5rem;
            border-radius: 0px 1.0rem 1.0rem 0px;
            border-left: 1px solid var(--surface-variant);
            background-color: var(--surface);
            transition-property: transform;
            transition-duration: 300ms;
            transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
            z-index: 41;
        }

        aside::before {
            content: '';
            pointer-events: none;
            position: absolute;
            top: 0px;
            left: 0px;
            width: 100%;
            height: 100%;
            border-radius: 0px 1.0rem 1.0rem 0px;
            background-color: var(--primary);
            opacity: 0.08;
        }

        .hidden aside {
            transform: translateX(-20.0rem);
        }

        #top-app-bar {
            display: flex;
            flex-direction: row;
            align-items: center;
            height: 3.0rem;
            padding: 0px 0.25rem;
            color: var(--on-surface);
        }

        #top-app-bar mwc-icon-button {
            --mdc-icon-size: 1.5rem;
            --mdc-icon-button-size: 3.0rem;
        }

        mwc-list {
            --mdc-list-side-padding: 0px;
            --mdc-list-item-graphic-margin: 0px;
        }

        mwc-list ::slotted(mwc-list-item) {
            border-radius: 100px;
            height: 3.0rem;
        }

        div.scrim {
            display: block;
            position: fixed;
            top: 0px;
            left: 0px;
            width: 100%;
            height: 100%;
            background-color: rgb(0, 0, 0);
            opacity: 0.32;
            z-index: 5;
            transition-property: opacity;
            transition-duration: 3000ms;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 40;
        }

        .hidden div.scrim {
            opacity: 0.0;
            display: none;
        }

        mwc-list {
            --mdc-theme-text-primary-on-background: var(--on-background);
            --mdc-theme-text-icon-on-background: var(--on-background);
        }
    ` as CSSResultGroup;

    title: string | null = null;

    @state()
    private visible: boolean = false;

    private onBackButton = () => {
        this.hide();
    }

    show() {
        window.backButton.push(() => { this.hide() });
        this.visible = true;
    }

    hide() {
        this.visible = false;
    }

    render() {
        return html`
            <div class="${classMap({"hidden": this.visible === false})}">
                <aside>
                    <div id="top-app-bar">
                        <mwc-icon-button icon="menu_open" @click=${this.hide}></mwc-icon-button>
                    </div>
                    <mwc-list activatable graphic="icon">
                        <slot name="entry"></slot>
                    </mwc-list>
                </aside>
                <div class="scrim" @click=${this.hide}></div>
            </div>
        `
    }
}