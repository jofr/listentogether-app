import { Events } from "../util/events";
import { AudioPlayer } from "./audio_player";
import { SyncedListeningState } from "../listening/sync";
import { logger } from "../util/logger";

export class AudioElementPlayer extends Events implements AudioPlayer {
    private _listeningState: SyncedListeningState;
    private audioElement: HTMLAudioElement;

    constructor() {
        super();

        this.audioElement = document.createElement("audio");
        this.audioElement.src = `${window.location.origin}${window.location.pathname}silence.mp3`;
        document.body.addEventListener("pointerdown", this.silentActivation);

        this.audioElement.addEventListener("timeupdate", () => this.emit("timeupdate"));
        this.audioElement.addEventListener("pause", () => this.emit("pause"));
        this.audioElement.addEventListener("play", () => this.emit("play"));
        this.audioElement.addEventListener("durationchange", () => this.emit("durationchange"));
        this.audioElement.addEventListener("seeked", () => this.emit("seeked"));
        this.audioElement.addEventListener("ended", () => this.emit("ended"));
    }

    private silentActivation = () => {
        this.audioElement.play().then(() => {
            if (this._listeningState.playback.paused) {
                this.audioElement.pause();
            }
            document.body.removeEventListener("pointerdown", this.silentActivation);
            logger.log("AudioElementPlayer silently activated");
        }).catch(error => {
            logger.log("Error while trying to silently activate AudioElemenPlayer:", error);
        });
    }

    private changeAudio = (): void => {
        this.audioElement.src = this._listeningState.playback.currentAudio;
        if (!this._listeningState.playback.paused) {
            this.audioElement.play();
        }
        this.emit("audiochange");
    }

    private updatePlay = (): void => {
        if (this._listeningState.playback.paused && !this.audioElement.paused) {
            this.audioElement.pause();
        } else if (!this._listeningState.playback.paused && this.audioElement.paused) {
            this.audioElement.play();
        }
    }

    private changeTime = (): void => {
        if (this._listeningState.playback.paused) {
            this.audioElement.currentTime = this._listeningState.playback.audioTime;
        } else {
            const now = Date.now();
            const diff = (now - this._listeningState.playback.referenceTime) / 1000.0;
            this.audioElement.currentTime = this._listeningState.playback.audioTime + diff;
        }
    }

    set listeningState(state: SyncedListeningState) {
        /* TODO: Should unsubscribe from possible previous listeningState (there might be more than one synchronized state) */

        this._listeningState = state;
        this._listeningState.subscribe(["playback/currentAudio"], this.changeAudio);
        this._listeningState.subscribe(["playback/paused"], this.updatePlay)
        this._listeningState.subscribe(["playback/referenceTime", "playback/audioTime"], this.changeTime);

        this.changeAudio();
        this.updatePlay();
        this.changeTime();
    }

    get duration(): number {
        return this.audioElement.duration;
    }

    get currentTime(): number {
        return this.audioElement.currentTime;
    }

    get paused(): boolean {
        return this.audioElement.paused;
    }

    get playbackRate(): number {
        return this.audioElement.playbackRate;
    }
}