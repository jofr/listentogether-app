import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators";

import { ModalDialog } from "./dialogs/modal_dialog";
import "./elements/listener_avatar";
import "./elements/loading_placeholder";
import "./dialogs/add_audio_dialog";
import "./dialogs/join_listening_dialog";
import "./dialogs/invite_listener_dialog";
import "./dialogs/share_settings_dialog";
import "./pages/audio_player";

@customElement("listen-together-app")
export class ListenTogetherApp extends LitElement {
    static styles = css`
        :host {
            display: flex;
            width: 100vw;
            height: 100vh;
            height: calc(var(--svh) * 100);
        }

        #pages {
            display: flex;
            width: 100%;
            height: 100%;
            flex-direction: row;
            justify-content: center;
        }
    `;

    showDialog(name: string) {
        let requestedDialog = document.querySelector(`${name}`);
        if (requestedDialog) {
            /* TODO: hide all other dialogs that are possibly still open */
            (requestedDialog as ModalDialog).show();
        }
    }

    render() {
        return html`
            <div id="pages">
                <slot name="page"></slot>
            </div>
            <div id="dialogs">
                <slot name="dialog"></slot>
            </div>
        `
    }
}