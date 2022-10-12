import { logger } from "../util/logger";
import { Events } from "../util/events";
import { AudioPlayer } from "./audio_player";
import { SyncableListeningState } from "../listening/state";

/**
 * {@link AudioPlayer} capable of syncing playback to the listening state as
 * long as the currently playing audio in the state is an audio file that can be
 * played by a HTMLAudioElement (so at least every audio publicly reachable via
 * HTTP).
 */
export class AudioElementPlayer extends Events implements AudioPlayer {
    private state: SyncableListeningState = null;
    private audioElement: HTMLAudioElement;
    private audioDurationFromMetadata: number;
    private silenceSrc: string = `${window.location.origin}${window.location.pathname}silence.mp3`;
    buffering: boolean = false;

    constructor() {
        super();

        this.audioElement = new Audio(this.silenceSrc);
        document.body.addEventListener("pointerdown", this.silentActivation);

        for (const event of ["timeupdate", "pause", "play", "durationchange", "seeked", "ended"]) {
            this.audioElement.addEventListener(event, () => this.emit(event));
        }
        for (const event of ["waiting", "stalled"]) {
            this.audioElement.addEventListener(event, () => {
                if (!this.buffering) {
                    this.buffering = true;
                    this.emit("buffering");
                }
            });
        }
        for (const event of ["canplay", "canplaythrough"]) {
            this.audioElement.addEventListener(event, () => {
                if (this.buffering) {
                    this.buffering = false;
                    this.emit("canplay");
                }
            });
        }
    }

    private silentActivation = () => {
        this.audioElement.play().then(() => {
            if (this.state == null || this.state.playback.paused) {
                this.audioElement.pause();
            }
            document.body.removeEventListener("pointerdown", this.silentActivation);
            logger.debug("AudioElementPlayer silently activated");
        }).catch(error => {
            logger.warn("Error while trying to silently activate AudioElemenPlayer:", error);
        });
    }

    private updateAudio = (): void => {
        const newSrc = this.state?.playback.currentAudio;
        if (this.audioElement.src !== newSrc && newSrc !== null) {
            this.audioElement.src = newSrc;
            (async () => {
                this.audioDurationFromMetadata = NaN;
                this.audioDurationFromMetadata = await window.metadataCache.getAudioInfo(newSrc).then(info => info.duration);
                this.emit("durationchange");
            })();
            if (!this.state.playback.paused) {
                this.audioElement.play();
            }
            this.emit("audiochange");
        }
    }

    private updatePlayPause = (): void => {
        if (this.state?.playback.paused && !this.audioElement.paused) {
            this.audioElement.pause();
        } else if (this.state && !this.state.playback.paused && this.audioElement.paused) {
            this.audioElement.play();
        }
    }

    private updateTime = (): void => {
        if (this.state?.playback.paused) {
            this.audioElement.currentTime = this.state.playback.audioTime;
        } else if (this.state) {
            const now = Date.now();
            const diff = (now - this.state.playback.referenceTime) / 1000.0;
            this.audioElement.currentTime = this.state.playback.audioTime + diff;
        }
    }

    set listeningState(state: SyncableListeningState) {
        if (this.state !== null) {
            this.state.unsubscribe(["playback/currentAudio"], this.updateAudio);
            this.state.unsubscribe(["playback/paused"], this.updatePlayPause)
            this.state.unsubscribe(["playback/referenceTime", "playback/audioTime"], this.updateTime);
        }

        this.state = state;
        this.state.subscribe(["playback/currentAudio"], this.updateAudio);
        this.state.subscribe(["playback/paused"], this.updatePlayPause)
        this.state.subscribe(["playback/referenceTime", "playback/audioTime"], this.updateTime);

        this.updateAudio();
        this.updatePlayPause();
        this.updateTime();
    }

    get duration(): number {
        // When the audio element loads a new audio file it might take a short
        // while before the duration information is available (if the browser
        // still has to load the file). During that timeframe we can use the
        // information from the metadata cache (if available). As soon as the
        // duration from the audio element is available we use that because it
        // is more accurate.
        return Number.isNaN(this.audioElement.duration) ? this.audioDurationFromMetadata : this.audioElement.duration;
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