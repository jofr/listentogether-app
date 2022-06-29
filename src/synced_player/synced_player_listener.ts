import { ListenerInfo, SyncedPlayer } from "./synced_player";
import { AudioInfo } from "../util/audio";

export enum ConnectionState {
    Connecting, Connected, Closed, Error
}

export class SyncedPlayerListener extends SyncedPlayer {
    private _hostId: string | null = null;
    private _connectionState: ConnectionState = ConnectionState.Connecting;
    private _audioActivated: boolean = false;

    constructor(hostId: string) {
        super();

        this._hostId = hostId;
    }

    protected peerSetup() {
        const connection = this._peer.connect(this._hostId, { reliable: true });
        connection.on("open", () => {
            console.info(`Connection to host ${this._hostId} open:`, connection);
            this._connectionState = ConnectionState.Connected;
            this.emit("connectionchange");
        });
        connection.on("close", () => {
            console.info(`Connection to host ${this._hostId} closed`);
            this._connectionState = ConnectionState.Closed;
            this.emit("connectionchange");
        });
        connection.on("error", (error: Error) => {
            console.error(`Error in connection to host ${this._hostId}:`, error);
            this._connectionState = ConnectionState.Error;
            this.emit("connectionchange");
        });
        connection.on("data", this.applySyncMessage);
    }
    
    protected peerError(error: any) {
        super.peerError(error);
        this._connectionState = ConnectionState.Error;
        this.emit("connectionchange");
    }

    private applySyncMessage = (data: any) => {
        if (data.type == "listeners") {
            console.log("Applying listeners sync:", data);
            this._state.listeners = data.listeners;
            this.emit("listenerschange");
        } else if (data.type == "playlist") {
            console.log("Applying playlist sync:", data);
            this._state.playlist = data.playlist;
            this.emit("playlistchange");
        } else if (data.type == "playback") {
            console.log("Applying playback sync:", data);

            const oldAudio = this._state.playback.currentAudio;
            this._state.playback = data.playback;
            if (this._state.playback.currentAudio != oldAudio) {
                this._audioElement.src = this._state.playback.currentAudio;
                this.emit("audiochange");
            }

            if (data.playback.paused) {
                this._audioElement.currentTime = data.playback.audioTime;
            } else {
                const now = Date.now();
                const difference = (now - data.playback.referenceTime) / 1000.0;
                this._audioElement.currentTime = data.playback.audioTime + difference;
            }            

            if (this._audioActivated) {
                if (data.playback.paused && !this._audioElement.paused) {
                    this._audioElement.pause();
                } else if (!data.playback.paused && this._audioElement.paused) {
                    this._audioElement.play().catch((error) => { console.error("User interaction needed before audio can be played", error); });
                }
            }
        }
    }

    public async silentAudioActivation() {
        await this._audioElement.play();
        this._audioActivated = true;
        if (this._state.playback.paused) {
            this._audioElement.pause();
        }
    }

    public addAudio(audio: AudioInfo) {
        console.log("Not allowed for listener");
    }

    public togglePlay() {
        console.log("Not allowed for listener");
    }

    public seek(time: number) {
        console.log("Not allowed for listener");
    }

    public replay() {
        console.log("Not allowed for listener");
    }

    public forward() {
        console.log("Not allowed for listener");
    }

    public skipPrevious() {
        console.log("Not allowed for listener");
    }

    public skipNext() {
        console.log("Not allowed for listener");
    }

    public moveAudio(url: string, deltaIndex: number) {
        console.log("Not allowed for listener");
    }

    get listeners(): ListenerInfo[] {
        const listeners = [{
            id: this._hostId,
            name: "Host"
        }, {
            id: this._peer.id,
            name: "+You"
        }];

        const otherListeners = this._state.listeners.filter((listener: ListenerInfo) => {
            if (![this._hostId, this._peer.id].includes(listener.id)) {
                return listener;
            }
        });

        return listeners.concat(otherListeners);
    }

    get inviteLink(): string {
        if (window.location.host.includes("localhost")) {
            return `https://listentogether.gitlab.io/app/#${this._hostId}`;
        } else {
            return `${window.location.origin}${window.location.pathname}#${this._hostId}`;
        }
    }

    get connectionState(): ConnectionState {
        return this._connectionState;
    }
}
