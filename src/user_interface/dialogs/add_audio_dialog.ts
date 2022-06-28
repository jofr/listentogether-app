import { html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators";
import "@material/mwc-button";
import "@material/mwc-textfield";
import "@material/mwc-list";
import "@material/mwc-list/mwc-check-list-item";
import "@material/mwc-circular-progress-four-color";

import { ModalDialog } from "./modal_dialog";
import { AudioInfo, extractAudios } from "../../util/audio";
import { extractURLs } from "../../util/util";


declare global {
    interface HTMLElementTagNameMap {
        "add-audio-dialog": AddAudioDialog;
    }
}

@customElement("add-audio-dialog")
export class AddAudioDialog extends ModalDialog {
    static styles = [
        ModalDialog.styles,
        css`
            mwc-list {
                margin-left: -16px;
                margin-right: -16px;
            }

            mwc-circular-progress-four-color {
                margin: 0px auto;
            }
        `
    ];

    @state()
    _possibleAudios: AudioInfo[] | null;

    @state()
    _processing: boolean = false;

    async setInput(input: string) {
        if (extractURLs(input) !== null) {
            this._processing = true;
            this._possibleAudios = await extractAudios(input);
            this._processing = false;
        }
    }

    private _onInput(event: Event) {
        const input = (event.target as HTMLInputElement).value;
        this.setInput(input);
    }

    private _addToPlaylist() {
        if (this._possibleAudios && window.syncedPlayer) {
            for (const audio of this._possibleAudios) {
                window.syncedPlayer.addAudio(audio);
            }
        }
        this.hide();
    }

    hide() {
        super.hide();

        this._possibleAudios = null;
    }

    renderContent() {
        if (this._possibleAudios) {
            return html`
                <mwc-list>
                    ${this._possibleAudios?.map(audio => html`
                        <mwc-list-item selected twoline graphic="medium">
                            <span>${audio.title}</span>
                            <span slot="secondary">${audio.album}</span>
                            <img slot="graphic" src="${audio.cover?.data &&  audio.cover?.format ? URL.createObjectURL(new Blob([audio.cover.data], { type: audio.cover.format })) : nothing}" />
                        </mwc-list-item>
                    `)}
                </mwc-list>
            `;
        } else if (this._processing) {
            return html`
                <mwc-circular-progress-four-color indeterminate></mwc-circular-progress-four-color>
            `
        } else {
            return html`
                <mwc-textfield outlined label="Paste audio information" @input=${this._onInput}></mwc-textfield>
            `
        }
    }

    renderActions() {
        return html`
            <mwc-button label="Cancel" @click=${this.hide}></mwc-button>
            <mwc-button ?disabled=${!this._possibleAudios} unelevated icon="queue_music" label="Add to playlist" @click=${this._addToPlaylist}></mwc-button>
        `;
    }
}