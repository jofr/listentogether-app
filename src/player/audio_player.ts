import { Events } from "../util/events";
import { ListeningState } from "../listening/state";

export interface AudioPlayer extends Events {
    listeningState: ListeningState;
    duration: number;
    currentTime: number;
    paused: boolean;
    playbackRate: number;
}