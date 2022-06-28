import QRCode from "qrcode";
import { DataConnection } from "peerjs";

import { ListenerInfo, SyncedPlayer } from "./synced_player";
import { AudioInfo } from "../util/audio";

export class SyncedPlayerHost extends SyncedPlayer {
    private listenerConnections: Set<DataConnection> = new Set<DataConnection>();
    private _inviteQRCode: string = "";

    protected peerSetup() {
        QRCode.toDataURL(this.inviteLink).then((dataURL: string) => this._inviteQRCode = dataURL);
        this._state.listeners.push({
            id: this._peer.id,
            name: "Host"
        });
        this.emit("listenerschange");
        this._peer.on("connection", (connection: DataConnection) => { this.listenerConnected(connection) });
    }

    private listenerConnected(connection: DataConnection) {
        this.listenerConnections.add(connection);
        connection.on("open", () => {
            console.info(`Connection to listener ${connection.peer} open:`, connection);
            this._state.listeners.push({
                id: connection.peer,
                name: "+1"
            });
            this.emit("listenerschange");
            this.sendListenersSyncToListeners([connection.peer]);
            this.sendPlaylistSyncToListeners([connection.peer]);
            this.sendPlaybackSyncToListeners([connection.peer]);
        });
        connection.on("close", () => {
            console.info(`Connection to listener ${connection.peer} closed`);
            const listener = this._state.listeners.find((listener: ListenerInfo) => listener.id === connection.peer);
            const index = this._state.listeners.indexOf(listener);
            this._state.listeners.splice(index, 1);
            this.listenerConnections.delete(connection);
            this.emit("listenerschange");
            this.sendListenersSyncToListeners();
        });
        connection.on("error", (error: Error) => {
            console.error(`Error in connection to listener ${connection.peer}:`, error);
        });
    }

    private sendSyncToListeners(data: any, listeners?: string[]) {
        const listenerConnections = listeners === undefined ? this.listenerConnections : Array.from(this.listenerConnections).filter((connection: DataConnection) => listeners.includes(connection.peer));
        for (const connection of listenerConnections) {
            if (connection.open) {
                connection.send(data);
            } else {
                console.warn("Connection to listener not open:", connection);
            }
        }
    }

    private sendListenersSyncToListeners(listeners?: string[]) {
        const data = {
            type: "listeners",
            listeners: this._state.listeners
        }
        console.info("Sending listeners sync to listeners:", data);
        this.sendSyncToListeners(data, listeners);
    }

    private sendPlaylistSyncToListeners(listeners?: string[]) {
        const data = {
            type: "playlist",
            playlist: this._state.playlist
        }
        console.info("Sending playlist sync to listeners:", data);
        this.sendSyncToListeners(data, listeners);
    }

    private sendPlaybackSyncToListeners(listeners?: string[]) {
        const data = {
            type: "playback",
            playback: this._state.playback
        }
        console.info("Sending playback sync to listeners:", data);
        this.sendSyncToListeners(data, listeners);
    }

    public addAudio(audio: AudioInfo) {
        super.addAudio(audio);
        this.sendPlaylistSyncToListeners();
    }

    public togglePlay() {
        const  paused = this._state.playback.paused;

        super.togglePlay();

        if (paused !== this._state.playback.paused) {
            this.sendPlaybackSyncToListeners();
        }
    }

    public seek(time: number) {
        super.seek(time);
        this.sendPlaybackSyncToListeners();
    }

    public replay() {
        super.replay();
        this.sendPlaybackSyncToListeners();
    }

    public forward() {
        super.forward();
        this.sendPlaybackSyncToListeners();
    }

    public skipPrevious() {
        super.skipPrevious();
        this.sendPlaybackSyncToListeners();
    }

    public skipNext() {
        super.skipNext();
        this.sendPlaybackSyncToListeners();
    }

    public playAudio(audio: string | number | AudioInfo) {
        super.playAudio(audio);
        this.sendPlaybackSyncToListeners();
    }

    get listeners(): ListenerInfo[] {
        return this._state.listeners.map((listener: ListenerInfo) => {
            if (listener.name == "Host") {
                return {
                    name: "You",
                    id: listener.id
                }
            } else {
                return listener;
            }
        });
    }

    get inviteLink(): string {
        if (window.location.host.includes("localhost")) {
            return `https://listentogether.gitlab.io/app/#${this._peer.id}`;
        } else {
            return `${window.location.origin}${window.location.pathname}#${this._peer.id}`;
        }
    }

    get inviteQRCode(): string {
        return this._inviteQRCode;
    }
}