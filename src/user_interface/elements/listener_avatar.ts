import * as Color from "color";
import * as SparkMD5 from "spark-md5";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators";
import "@material/mwc-button";
import "@material/mwc-textfield";
import "@material/mwc-list";
import "@material/mwc-list/mwc-check-list-item";

declare global {
    interface HTMLElementTagNameMap {
        "listener-avatar": ListenerAvatar;
    }
}

@customElement("listener-avatar")
export class ListenerAvatar extends LitElement {
    static styles = css`
        .avatar {
            position: relative;
            width: var(--avatar-size, 2.5rem);
            height: var(--avatar-size, 2.5rem);
            border-radius: var(--avatar-radius, 1.1rem);
            background: linear-gradient(var(--angle), var(--first-color), var(--second-color));
        }

        span {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-55%, -50%);
            font-size: 0.6rem;
            text-transform: uppercase;
        }
    `;

    private _firstColor: string;
    private _secondColor: string;
    private _angle: number;

    @property({ reflect: true })
    id: string;

    @property({ reflect: true })
    name: string;

    connectedCallback(): void {
        super.connectedCallback();
        this._generateGradient();
    }

    /* Mainly taken and modified from: https://github.com/tobiaslins/avatar/tree/master/src */
    private _generateGradient() {
        const hash = SparkMD5.hash(this.id);
        console.error(this.id, hash)

        let firstColor = new Color(`#${hash.substring(0, 6)}`).saturate(0.5);
        const lightning = firstColor.hsl().color[2];
        if (lightning < 25) {
            firstColor = firstColor.lighten(3);
        }
        if (lightning > 25 && lightning < 40) {
            firstColor = firstColor.lighten(0.8);
        }
        if (lightning > 75) {
            firstColor = firstColor.darken(0.4);
        }

        let secondColor = firstColor;
        if (secondColor.isDark()) {
            secondColor = secondColor.saturate(0.3).rotate(90);
        } else {
            secondColor = secondColor.desaturate(0.3).rotate(90);
        }
        const rgb = secondColor.rgb().array();
        const val = 765 - (rgb[0] + rgb[1] + rgb[2]);
        const shouldChangeColor = (val < 250 || val > 700) ? true : false;
        if (shouldChangeColor) {
            secondColor = secondColor.rotate(-200).saturate(0.5);
        }

        this._firstColor = firstColor.hex();
        this._secondColor = secondColor.hex();
        this._angle = 10 + 2 * parseInt(hash.substr(0, 1), 16);
    }


    render() {
        return html`
            <div class="avatar" style="--angle: ${this._angle}deg; --first-color: ${this._firstColor}; --second-color: ${this._secondColor};">
                <span>${this.name}</span>
            </div>
        `
    }
}