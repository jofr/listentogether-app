import { Peer } from "peerjs";

import { AudioInfo } from "../util/audio";
import { Events } from "../util/events";

import config from "../../config.json";

export type ListenerInfo = {
    id: string,
    name: string
}

export type PlaybackState = {
    referenceTime: number,
    currentAudio: string | null,
    currentTime: number,
    paused: boolean
}

export type PlayerState = {
    playlist: AudioInfo[],
    playback: PlaybackState,
    listeners: ListenerInfo[]
}

export class SyncedPlayer extends Events {
    protected _audioElement: HTMLAudioElement;
    protected _state: PlayerState = {
        playlist: [],
        playback: {
            referenceTime: 0,
            currentAudio: null,
            currentTime: 0,
            paused: true
        },
        listeners: []
    }

    protected _peer: Peer;

    constructor() {
        super();

        this.createAudioElement();
        this.createPeer();
    }

    private createAudioElement() {
        this._audioElement = document.createElement("audio");
        this._audioElement.src = `${window.location.origin}${window.location.pathname}/silence.mp3`;
        document.body.appendChild(this._audioElement);

        this._audioElement.addEventListener("timeupdate", () => {
            this._state.playback.referenceTime = Date.now();
            this._state.playback.currentTime = this._audioElement.currentTime;
            this.emit("timeupdate")
        });
        this._audioElement.addEventListener("pause", () => this.emit("pause"));
        this._audioElement.addEventListener("play", () => this.emit("play"));
        this._audioElement.addEventListener("durationchange", () => {
            if (this.currentAudio) {
                this.currentAudio.duration = this._audioElement.duration;
                this.emit("durationchange");
            }
        });
    }

    private createPeer() {
        const id = Math.floor(Math.random()*2**18).toString(36).padStart(4,'0');
        this._peer = new Peer(id, {
            host: config.peerServer,
            path: "/",
            port: config.signalingPort,
            secure: false,
            debug: 4,
            config: {'iceServers': [
                { url: 'stun:stun.l.google.com:19302' },
                { url: `turn:${config.peerServer}:${config.turnPort}`, username: 'foo', credential: 'bar' }
            ]} 
        });
        this._peer.on("open", () => { this.peerSetup(); });
        this._peer.on("disconnected", () => {
            console.warn("Lost connection to signaling server, trying to reconnect");
            this._peer.reconnect(); /* TODO: Does this call peerSetup() again? (through the open event) */
        });
        this._peer.on("error", (error) => { this.peerError(error) });
    }

    protected peerSetup() {
        return;
    }

    protected peerError(error: any) {
        console.log("Peer error:", error);
    }

    public addAudio(audio: AudioInfo) {
        this._state.playlist.push(audio);
        this.emit("playlistchange");

        if (this.currentAudio === null && this._state.playlist.length > 0) {
            this.playAudio(audio);
        }
    }

    public togglePlay() {
        this._state.playback.paused = !this._state.playback.paused;
        if (this._state.playback.paused && !this._audioElement.paused) {
            this._audioElement.pause();
        } else if (!this._state.playback.paused && this._audioElement.paused) {
            this._audioElement.play().then(() => { }).catch((error) => console.error(error));
        }
    }

    public seek(time: number) {
        this._audioElement.currentTime = time;
    }

    public replay() {
        this._audioElement.currentTime -= 30.0;
    }

    public forward() {
        this._audioElement.currentTime += 30.0;
    }

    public skipPrevious() {
        const index = this._state.playlist.indexOf(this.currentAudio);
        if ((index - 1) >= 0) {
            this.playAudio(this._state.playlist[index - 1]);
        }
    }

    public skipNext() {
        const index = this._state.playlist.indexOf(this.currentAudio);
        if (this._state.playlist.length > (index + 1)) {
            this.playAudio(this._state.playlist[index + 1].url);
        }
    }

    public moveAudio(url: string, deltaIndex: number) {
        const audio = this._state.playlist.find((audio: AudioInfo) => audio.url == url);
        const index = this._state.playlist.indexOf(audio);
        if (index !== -1) {
            this._state.playlist.splice(index, 1);
            this._state.playlist.splice(index + deltaIndex, 0, audio);

            this.emit("playlistchange");
        }
    }

    public playAudio(audio: string | number | AudioInfo) {
        let audioInfo: AudioInfo | null = null;

        if (typeof(audio) == "number") {
            audioInfo = this._state.playlist[audio];
        } else if (typeof(audio) == "string") {
            const index = this._state.playlist.indexOf(this._state.playlist.find((a: AudioInfo) => a.url == audio));
            audioInfo = this._state.playlist[index];
        } else {
            if (this._state.playlist.includes(audio)) {
                audioInfo = audio;
            }
        }

        if (audioInfo) {
            this._state.playback.currentAudio = audioInfo.url;
            this._audioElement.src = audioInfo.url;

            if (!this._state.playback.paused) {
                this._audioElement.play().then(() => { }).catch((error) => console.error(error));
            }

            this.emit("audiochange");
        }
    }

    get state() {
        return this._state;
    }

    get currentAudio(): AudioInfo | null {
        return this._state.playlist.find((audio: AudioInfo) => audio.url == this._state.playback.currentAudio) || null;
    }

    get listeners(): ListenerInfo[] {
        return this._state.listeners;
    }

    get inviteLink(): string {
        return "";
    }

    get inviteQRCode(): string {
        return "";
    }
}