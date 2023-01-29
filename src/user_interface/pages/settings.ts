import { RequestSelectedDetail } from "@material/mwc-list/mwc-list-item-base";
import { html, css } from "lit";
import { customElement, state } from "lit/decorators";

import { AppPage } from "./page";

declare global {
    interface HTMLElementTagNameMap {
        "app-settings": AppSettings;
    }
}

@customElement("app-settings")
export class AppSettings extends AppPage {
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
                --mdc-checkbox-unchecked-color: var(--on-surface-variant);
                --mdc-checkbox-checked-color: var(--secondary);
                --mdc-checkbox-ink-color: var(--on-secondary);
                --mdc-list-item-graphic-margin: 0.5rem;

                position: relative;
                margin: 0px -1.0rem 0px -1.0rem;
            }

            mwc-textfield {
                display: flex;
                --mdc-text-field-label-ink-color: var(--on-surface-variant);
                --mdc-text-field-ink-color: var(--on-surface-variant);
                --mdc-text-field-fill-color: var(--surface-variant);
                --mdc-text-field-outlined-idle-border-color: var(--outline);
                --mdc-text-field-outlined-hover-border-color: var(--on-surface);
            }

            mwc-textfield[hidden] {
                display: none;
            }
        `
    ];

    title = "Settings";
    icon = "settings";
    topAppBar = "small";

    @state()
    private showCustomBackendHost = window.settings.useCustomBackend;

    setDarkMode(event: CustomEvent<RequestSelectedDetail>) {
        if (event.detail.source === "property") {
            window.settings.darkMode = event.detail.selected;
        }
    }

    setUseDefaultBackend(event: CustomEvent<RequestSelectedDetail>) {
        if (event.detail.source === "property") {
            window.settings.useCustomBackend = event.detail.selected;
            this.showCustomBackendHost = event.detail.selected;
        }
    }

    setCustomBackendHost(event: InputEvent) {
        window.settings.customBackendHost = (event.target as HTMLInputElement).value;
    }

    render() {
        return html`
            <mwc-list multi>
                <mwc-check-list-item ?selected=${window.settings.darkMode} graphic="icon" @request-selected=${this.setDarkMode}>
                    <span>Dark mode</span>
                    <mwc-icon slot="graphic">dark_mode</mwc-icon>
                </mwc-check-list-item>
                <mwc-check-list-item ?selected=${window.settings.useCustomBackend} graphic="icon" @request-selected=${this.setUseDefaultBackend}>
                    <span>Use custom backend server</span>
                    <mwc-icon slot="graphic">cloud_sync</mwc-icon>
                </mwc-check-list-item>
                <mwc-textfield ?hidden=${!this.showCustomBackendHost} label="Backend host" icon="link" value=${window.settings.customBackendHost} @change=${this.setCustomBackendHost}></mwc-textfield>
            </mwc-list>
        `;
    }
}
