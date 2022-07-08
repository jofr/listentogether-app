import { ReactiveController, ReactiveControllerHost } from "lit";

import { ListeningSession } from "../../listening/session";

export type SessionControllerConfig = {
    subscribe?: string[],
    listen?: string[]
}

export class SessionController implements ReactiveController {
    private host: ReactiveControllerHost;
    private config: SessionControllerConfig;
    private requestHostUpdate = () => this.host.requestUpdate();

    public session: ListeningSession | null = null;
    
    constructor(host: ReactiveControllerHost, config?: SessionControllerConfig) {
        this.host = host;
        this.config = config || { };
        this.host.addController(this);
        this.updateSession();
        window.addEventListener("sessionchange", this.updateSession);
    }

    private updateSession = () => {
        if (this.session !== null) {
            /* TODO: unlisten and unsubscribe from previous session */
        }

        this.session = window.session || null;
        if (this.session !== null) {
            if (this.config.listen) {
                for (const listen of this.config.listen) {
                    this.session.on(listen, this.requestHostUpdate);
                }
            }

            if (this.config.subscribe) {
                this.session.subscribe(this.config.subscribe, this.requestHostUpdate);
            }
        }

        this.host.requestUpdate();
    }

    hostConnected(): void {
        
    }
}