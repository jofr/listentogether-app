import { html, css } from "lit";
import { customElement } from "lit/decorators";

import { ModalDialog } from "./modal_dialog";
import { SessionController } from "../controllers/session";
import { ListeningHost } from "../../listening/peer";
import { ListeningSession } from "../../listening/session";

declare global {
    interface HTMLElementTagNameMap {
        "share-settings-dialog": ShareSettingsDialog;
    }
}

@customElement("share-settings-dialog")
export class ShareSettingsDialog extends ModalDialog {
    static styles = [
        ModalDialog.styles,
        css`
            mwc-button {
                --mdc-theme-primary: var(--error);
                --mdc-theme-on-primary: var(--on-error);
            }
        `
    ];

    private sessionController = new SessionController(this);

    private endListening() {
        window.session = ListeningSession.CreateHost();
        this.hide();
    }

    private leaveListening() {
        window.session = ListeningSession.CreateHost();
        this.hide();
    }

    renderContent() {
        const session = this.sessionController.session;

        if (session?.peer && session.peer instanceof ListeningHost) {
            return html`
                <mwc-button unelevated icon="exit_to_app" label="End listening" @click=${this.endListening}></mwc-button>
            `;
        } else {
            return html`
                <mwc-button unelevated icon="logout" label="Leave listening" @click=${this.leaveListening}></mwc-button>
            `;
        }        
    }
}