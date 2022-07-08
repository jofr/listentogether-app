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
        "loading-placeholder": LoadingPlaceholder;
    }
}

@customElement("loading-placeholder")
export class LoadingPlaceholder extends LitElement {
    static styles = css`
        span {
            background-color: currentColor;
            border-radius: 0.125rem;
            animation: fading 1.5s infinite;
        }

        @keyframes fading {
            0% {
              opacity: .1;
            }
            
            50% {
              opacity: .2;
            }
            
            100% {
              opacity: .1;
            }
        }
    `;

    @property()
    characters: number = 10;

    render() {
        return html`
            <span>${"".padStart(this.characters, "⠀")}</span>
        `
    }
}