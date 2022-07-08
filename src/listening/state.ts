export type AudioUri = string;

export type ListenerId = string;

export type PlaybackState = {
    currentAudio: AudioUri | null,
    referenceTime: number,
    audioTime: number,
    paused: boolean
}

export type ListeningState = {
    playback: PlaybackState,
    playlist: AudioUri[],
    listeners: ListenerId[]
}