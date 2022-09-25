import { LitElement, css, CSSResultGroup } from "lit";
import { customElement } from "lit/decorators";

declare global {
    interface HTMLElementTagNameMap {
        "app-page": AppPage;
    }
}

@customElement("app-page")
export class AppPage extends LitElement {
    static styles = css`
        :host {
            box-sizing: border-box;
            display: block;
            padding: 0px var(--content-padding);
            scroll-snap-align: start;
        }
    ` as CSSResultGroup;

    title: string = "";
    icon: string = "";
    topAppBar: string = "";
}