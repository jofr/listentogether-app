import { LitElement, html, css, CSSResultGroup } from "lit";
import { state } from "lit/decorators";
import { classMap } from "lit/directives/class-map";
import "@material/mwc-button";

export class ModalDialog extends LitElement {
    static styles = css`
        mwc-button {
            --mdc-shape-small: 1.125rem;
        }

        div.surface {
            position: fixed;
            bottom: 0px;
            left: 0px;
            width: 100%;
            max-height: min(80vh, max(60vh, 30.0rem));
            overflow: hidden;
            border-radius: 1.5rem 1.5rem 0px 0px;
            background-color: var(--surface);
            color: var(--on-surface);
            display: grid;
            grid-template-rows: auto 1fr auto;
            z-index: 21;
            transition-property: transform;
            transition-duration: 300ms;
            transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
            
        }

        div.surface::before {
            content: '';
            pointer-events: none;
            position: absolute;
            top: 0px;
            left: 0px;
            width: 100%;
            height: 100%;
            background-color: var(--primary);
            opacity: 0.05;
        }

        .hidden div.surface {
            transform: translateY(100%);
        }

        div.title {
            padding: var(--content-padding) var(--content-padding) 0px var(--content-padding);
        }

        div.title h1 {
            padding: 0px;
            margin: 0px;
            font-size: 1.5rem;
            font-weight: 400;
            line-height: 2.0rem;
        }

        div.content {
            overflow-y: scroll;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            padding: var(--title-padding) var(--content-padding) 0px var(--content-padding);
            gap: 0.5rem;
            width: 100%;
            color: var(--on-surface-variant);
        }

        .content p {
            font-size: 0.875rem;
            font-weight: 400;
            line-height: 1.25rem;
            color: var(--on-surface-variant);
            hyphens: auto;
        }

        div.actions {
            display: flex;
            flex-direction: row;
            justify-content: flex-end;
            align-items: center;
            padding: var(--content-padding);
            gap: 0.5rem;
        }

        .dismiss {
            width: 100%;
            text-align: center;
            font-family: 'Material Symbols Outlined';
            font-size: 1.7rem;
            align-self: center;
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
            transition-duration: 300ms;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 20;
        }

        .hidden div.scrim {
            opacity: 0.0;
            display: none;
        }
    ` as CSSResultGroup;

    title: string | null = null;

    @state()
    private visible: boolean = false;

    show() {
        window.backButton.push(() => { this.hide() });
        this.visible = true;
    }

    hide() {
        this.visible = false;
    }

    renderContent() {
        return html``;
    }

    renderActions() {
        return html`
            <div class="dismiss" @click=${this.hide}>keyboard_arrow_down</div>
        `;
    }

    render() {
        return html`
            <div class="${classMap({"hidden": this.visible === false})}">
                <div class="surface">
                    <div class="title">
                        <h1>${this.title}</h1>
                    </div>
                    <div class="content">
                        ${this.renderContent()}
                    </div>
                    <div class="actions">
                        ${this.renderActions()}
                    </div>
                </div>
                <div class="scrim" @click=${this.hide}></div>
            </div>
        `
    }
}