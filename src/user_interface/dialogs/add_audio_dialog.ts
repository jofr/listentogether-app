import { html, css } from "lit";
import { customElement, state } from "lit/decorators";
import "@material/mwc-button";
import "@material/mwc-textfield";
import "@material/mwc-list";
import "@material/mwc-list/mwc-check-list-item";
import "@material/mwc-circular-progress-four-color";

import { ModalDialog } from "./modal_dialog";
import { AudioInfo } from "../../audio_info/audio_info";
import { extractAudios } from "../../audio_info/extract";
import { extractUrls } from "../../util/util";
import { SessionController } from "../controllers/session";

declare global {
    interface HTMLElementTagNameMap {
        "add-audio-dialog": AddAudioDialog;
    }
}

const defaultCoverData = `<svg xmlns="http://www.w3.org/2000/svg" height="48" width="48"><path d="M19.65 42Q16.5 42 14.325 39.825Q12.15 37.65 12.15 34.5Q12.15 31.35 14.325 29.175Q16.5 27 19.65 27Q21.05 27 22.175 27.4Q23.3 27.8 24.15 28.5V6H35.85V12.75H27.15V34.5Q27.15 37.65 24.975 39.825Q22.8 42 19.65 42Z"/></svg>`;
const defaultCoverObjectUrl = URL.createObjectURL(new Blob([defaultCoverData], { type: "image/svg+xml" }));

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

            mwc-textfield {
                --mdc-text-field-label-ink-color: var(--on-surface-variant);
                --mdc-text-field-ink-color: var(--on-surface);
                --mdc-text-field-outlined-idle-border-color: var(--outline);
                --mdc-text-field-outlined-hover-border-color: var(--on-surface);
            }

            mwc-button {
                --mdc-button-disabled-fill-color: var(--on-surface-opacity-12);
                --mdc-button-disabled-ink-color: var(--on-surface-opacity-38);
                --mdc-theme-primary: var(--primary);
                --mdc-theme-on-primary: var(--on-primary);
            }
        `
    ];

    @state()
    private possibleAudios: AudioInfo[] | null;

    @state()
    private processing: boolean = false;

    private sessionController = new SessionController(this);

    async setInput(input: string) {
        if (extractUrls(input) !== null) {
            this.processing = true;
            this.possibleAudios = await extractAudios(input);
            this.processing = false;
        }
    }

    private onInput(event: Event) {
        const input = (event.target as HTMLInputElement).value;
        this.setInput(input);
    }

    private addToPlaylist() {
        const selectedIndices = this.shadowRoot.querySelector("mwc-list").index as Set<number>;
        if (this.possibleAudios && this.sessionController.session) {
            for (let i = 0; i < this.possibleAudios.length; i++) {
                if (selectedIndices.has(i)) {
                    this.sessionController.session.addAudio(this.possibleAudios[i].uri);
                }
            }
        }
        this.hide();
    }

    hide() {
        super.hide();

        this.possibleAudios = null;
    }

    renderContent() {
        if (this.possibleAudios) {
            return html`
                <mwc-list multi>
                    ${this.possibleAudios?.map(audio => html`
                        <mwc-check-list-item selected twoline graphic="medium">
                            <span>${audio.title}</span>
                            <span slot="secondary">${audio.album}</span>
                            <img slot="graphic" src="${audio.cover ? audio.cover.objectUrl : defaultCoverObjectUrl}" />
                        </mwc-check-list-item>
                    `)}
                </mwc-list>
            `;
        } else if (this.processing) {
            return html`
                <mwc-circular-progress-four-color indeterminate></mwc-circular-progress-four-color>
            `
        } else {
            return html`
                <mwc-textfield outlined label="Paste audio URLs" @input=${this.onInput}></mwc-textfield>
            `
        }
    }

    renderActions() {
        return html`
            <mwc-button label="Cancel" @click=${this.hide}></mwc-button>
            <mwc-button ?disabled=${!this.possibleAudios} unelevated icon="queue_music" label="Add to playlist" @click=${this.addToPlaylist}></mwc-button>
        `;
    }
}