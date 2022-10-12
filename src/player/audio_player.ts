import { Events } from "../util/events";
import { ListeningState } from "../listening/state";

export interface AudioPlayerEvents {
    "timeupdate": () => void;
    "pause": () => void;
    "play": () => void;
    "durationchange": () => void;
    "seeked": () => void;
    "ended": () => void;
    "buffering": () => void;
    "canplay": () => void;
    "audiochange": () => void;
}

/**
 * General interface for an audio player that can sync its playback to a
 * listening state (set using {@link AudioPlayer#listeningState}). Must not
 * provide any functions to change playback directly, playback can instead be
 * controlled by changing the listening state and the audio player will try to
 * catch up and be as close as possible to that desired state.
 *
 * Interface and emitted events (see {@link AudioPlayerEvents}) are modeled
 * closely after the familiar HTMLMediaElement API.
 */
export interface AudioPlayer extends Events {
    listeningState: ListeningState;
    emit<U extends keyof AudioPlayerEvents>(event: U, ...args: Parameters<AudioPlayerEvents[U]>): void;
    readonly duration: number;
    readonly currentTime: number;
    readonly paused: boolean;
    readonly playbackRate: number;
    readonly buffering: boolean;
}