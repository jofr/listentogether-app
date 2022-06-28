import { ReactiveController, ReactiveControllerHost } from "lit";

import { SyncedPlayerHost } from "../../synced_player/synced_player_host";
import { SyncedPlayerListener } from "../../synced_player/synced_player_listener";

export class SyncedPlayerController implements ReactiveController {
    private _host: ReactiveControllerHost;
    private _subscribedEvents: string[] = [];
    private _subscribedEventsHandler: (...args: any[]) => void;
    private _player: SyncedPlayerHost | SyncedPlayerListener | null = null;
    
    constructor(host: ReactiveControllerHost, events: string[] = []) {
        this._host = host;
        this._host.addController(this);

        this._subscribedEvents = events;
        this._subscribedEventsHandler = () => this._host.requestUpdate();

        this._updateSyncedPlayer();
        window.addEventListener("syncedplayerchange", () => this._updateSyncedPlayer());
    }

    hostConnected(): void {
        
    }

    private _updateSyncedPlayer() {
        if (this._player !== null) {
            for (const event of this._subscribedEvents) {
                this._player.off(event, this._subscribedEventsHandler);
            }
        }

        this._player = window.syncedPlayer || null;
        if (this._player !== null) {
            for (const event of this._subscribedEvents) {
                this._player.on(event, this._subscribedEventsHandler);
            }
        }
    }

    get player() {
        return this._player;
    }
}