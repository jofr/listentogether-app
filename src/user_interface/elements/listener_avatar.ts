import * as Color from "color";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators";

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

    private firstColor: string;
    private secondColor: string;
    private angle: number;

    @property()
    id: string;

    @property()
    name: string;

    private generateGradient() {
        // Alphabet of characters used for random IDs is in ASCII range
        // [48..122] (letters, numbers, some symbols) and we need a random color
        // in hex notation. So just map the first three ID characters (one each
        // for r, g and b) from the used range [48..122] to the needed range
        // [0..255] and convert this to its hexadecimal string representation
        // (this of course looses resolution and not all values are possible
        // because some symbols in that ASCII range are never used for the ID
        // but should be good enough for this purpose)
        const hex = Array.from(this.id.substring(0, 3)).map(x => Math.floor((x.charCodeAt(0) - 48) * 3.45).toString(16).padStart(2, "0")).join("");

        // This part (generating two matching colors for gradient) is taken from
        // https://github.com/tobiaslins/avatar/tree/master/src */
        let firstColor = new Color(`#${hex}`).saturate(0.5);
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

        this.firstColor = firstColor.hex();
        this.secondColor = secondColor.hex();
        this.angle = 10 + 2 * parseInt(hex.substring(0, 1), 16);
    }

    render() {
        this.generateGradient();

        return html`
            <div class="avatar" style="--angle: ${this.angle}deg; --first-color: ${this.firstColor}; --second-color: ${this.secondColor};">
                <span>${this.name}</span>
            </div>
        `
    }
}