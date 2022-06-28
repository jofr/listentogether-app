import { html, css } from "lit";
import { customElement } from "lit/decorators";

import { ModalDialog } from "./modal_dialog";
import { SyncedPlayerController } from "../controllers/synced_player";

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

    private _playerController = new SyncedPlayerController(this);

    renderContent() {
        return html`   
        `;
    }
}