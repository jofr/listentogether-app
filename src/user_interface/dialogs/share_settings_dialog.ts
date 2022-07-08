import { html, css } from "lit";
import { customElement } from "lit/decorators";

import { ModalDialog } from "./modal_dialog";
import { SessionController } from "../controllers/session";

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
        `
    ];

    private sessionController = new SessionController(this);

    renderContent() {
        return html`   
        `;
    }
}