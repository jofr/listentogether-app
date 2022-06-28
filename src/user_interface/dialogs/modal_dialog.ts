import { LitElement, html, css, CSSResultGroup } from "lit";
import { state } from "lit/decorators";
import { classMap } from "lit/directives/class-map";
import "@material/mwc-button";

export class ModalDialog extends LitElement {
    static styles = css`
        div.surface {
            position: fixed;
            bottom: 0px;
            left: 0px;
            width: 100%;
            max-height: min(80vh, max(60vh, 30.0rem));
            background-color: var(--mdc-theme-surface);
            overflow: hidden;
            color: var(--mdc-theme-on-surface);
            border-radius: 0.5rem 0.5rem 0px 0px;
            display: grid;
            grid-template-rows: 1fr 3.5rem;
            z-index: 10;
            transition: 0.4s ease-in-out;
            box-shadow: 0px 11px 15px -7px rgb(0 0 0 / 20%), 0px 24px 38px 3px rgb(0 0 0 / 14%), 0px 9px 46px 8px rgb(0 0 0 / 12%);
        }

        div.surface.hidden {
            transform: translateY(120%);
        }

        div.content {
            overflow-y: scroll;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            padding: 1.0rem;
            gap: 0.5rem;
            width: 100%;
        }

        div.actions {
            display: flex;
            flex-direction: row;
            justify-content: flex-end;
            align-items: center;
            margin: 0px 1.0rem;
            gap: 0.5rem;
        }

        .dismiss {
            width: 100%;
            text-align: center;
            font-family: 'Material Icons';
            font-size: 1.7rem;
            align-self: center;
        }
    ` as CSSResultGroup;

    @state()
    _visible: boolean = false;

    private _documentClick = (event: Event) => {
        if (!event.composedPath().includes(this.shadowRoot)) {
            event.stopPropagation();
            this.hide();
        }
    }

    show() {
        this._visible = true;
        document.addEventListener("click", this._documentClick, true);
    }

    hide() {
        this._visible = false;
        document.removeEventListener("click", this._documentClick, true);
    }

    renderContent() {
        return html``;
    }

    renderActions() {
        return html`
            <span class="dismiss" @click=${this.hide}>keyboard_arrow_down</span>
        `;
    }

    render() {
        return html`
            <div class="surface ${classMap({"hidden": this._visible === false})}">
                <div class="content">
                    ${this.renderContent()}
                </div>
                <div class="actions">
                    ${this.renderActions()}
                </div>
            </div>
        `
    }
}