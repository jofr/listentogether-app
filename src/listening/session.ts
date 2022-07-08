import { MediaSession } from "capacitor-media-session";

import { Events } from "../util/events";
import { SyncedListeningState } from "./sync";
import { ListeningHost, ListeningListener } from "./peer";
import { AudioUri, ListeningState, PlaybackState } from "./state";
import { AudioInfo } from "../audio_info/audio_info";
import { AudioPlayer } from "../player/audio_player";
import { logger } from "../util/logger";

export type ListenerInfo = {
    id: string,
    name: string
}

export class ListeningSession extends Events {
    constructor(private internalState: SyncedListeningState, readonly peer: ListeningHost | ListeningListener) {
        super();

        MediaSession.setActionHandler({ action: "play" }, () => this.togglePlay("play"));
        MediaSession.setActionHandler({ action: "pause" }, () => this.togglePlay("pause"));
        MediaSession.setActionHandler({ action: "seekto" }, (details: any) => this.seek(details.seekTime));
        MediaSession.setActionHandler({ action: "seekbackward" }, () => this.replay());
        MediaSession.setActionHandler({ action: "seekforward" }, () => this.forward());

        this.player.on(["play", "pause", "durationchange", "seeked"], this.updateMediaSessionPlaybackState);
        internalState.subscribe(["playback/currentAudio", "playlist"], this.updateMediaSessionActions);
        internalState.subscribe(["playback/currentAudio"], this.updateMediaSessionMetadata);
    }

    static CreateHost() {
        const state = new SyncedListeningState();
        const host = new ListeningHost(state);

        return new ListeningSession(state, host);
    }

    static CreateListener(hostId: string) {
        const state = new SyncedListeningState();
        const listener = new ListeningListener(hostId, state);

        return new ListeningSession(state, listener);
    }

    private updateMediaSessionPlaybackState = () => {
        MediaSession.setPlaybackState({
            playbackState: this.player.paused ? "paused" : "playing"
        });
        MediaSession.setPositionState({
            duration: this.player.duration || 0.0,
            position: this.player.currentTime || 0.0,
            playbackRate: this.player.playbackRate
        });
    }

    private updateMediaSessionActions = () => {
        if (!this.currentAudio || this.playlist.findIndex((audio: AudioInfo) => audio.uri === this.currentAudio.uri) === 0) {
            MediaSession.setActionHandler({ action: "previoustrack" }, null);
        } else {
            MediaSession.setActionHandler({ action: "previoustrack" }, () => this.skipPrevious());
        }

        if (!this.currentAudio || this.playlist.findIndex((audio: AudioInfo) => audio.uri === this.currentAudio.uri) === (this.playlist.length - 1)) {
            MediaSession.setActionHandler({ action: "nexttrack" }, null);
        } else {
            MediaSession.setActionHandler({ action: "nexttrack" }, () => this.skipNext());
        }
    }

    private updateMediaSessionMetadata = async () => {
        const audioInfo = await window.audioInfoCache.get(this.currentAudio.uri);
        const mediaMetadata: MediaMetadataInit = {
            title: audioInfo.title,
            artist: audioInfo.artist,
            album: audioInfo.album,
            artwork: []
        }
        if (audioInfo.cover) {
            mediaMetadata.artwork = [
                {
                    src: audioInfo.cover.objectUrl,
                    sizes: "361x361",
                    type: audioInfo.cover.format
                }
            ]
        }
        MediaSession.setMetadata(mediaMetadata);
    }

    addAudio(audio: AudioUri) {
        this.internalState.applyChange((state: ListeningState) => {
            state.playlist.push(audio);
        });

        if (this.internalState.playback.currentAudio === null) {
            this.playAudio(audio);
        }
    }

    moveAudio(url: string, deltaIndex: number) {
        return;
    }

    playAudio(audio: AudioUri) {
        if (!this.internalState.playlist.includes(audio)) {
            logger.warn(`Request to play audio which is not in playlist ignored: ${audio}`);
            return;
        }

        this.internalState.applyChange((state: ListeningState) => {
            state.playback.currentAudio = audio;
            state.playback.audioTime = 0;
            state.playback.referenceTime = Date.now();
        });
    }

    togglePlay(playState?: "play" | "pause") {
        this.internalState.applyChange((state: ListeningState) => {
            state.playback.paused = playState ? (playState === "pause" ? true : false) : !state.playback.paused;
            state.playback.audioTime = this.player.currentTime;
            state.playback.referenceTime = Date.now();
        });
    }

    seek(time: number) {
        this.internalState.applyChange((state: ListeningState) => {
            state.playback.audioTime = time;
            state.playback.referenceTime = Date.now();
        });
    }

    replay() {
        this.seek(this.player.currentTime - 30.0);
    }

    forward() {
        this.seek(this.player.currentTime + 30.0);
    }

    skipPrevious() {
        const index = this.internalState.playlist.indexOf(this.internalState.playback.currentAudio);
        if ((index - 1) >= 0) {
            this.playAudio(this.internalState.playlist[index - 1]);
        }
    }

    skipNext() {
        const index = this.internalState.playlist.indexOf(this.internalState.playback.currentAudio);
        if ((index + 1) < this.internalState.playlist.length) {
            this.playAudio(this.internalState.playlist[index + 1]);
        }
    }

    on(eventName: string | string[], eventHandler: (...args: any[]) => void) {
        const playerEvents = ["audiochange", "timeupdate", "pause", "play", "durationchange"];

        const onSelfOrPlayer = (eventName: string, eventHandler: (...args: any[]) => void) => {
            if (playerEvents.includes(eventName)) {
                this.player.on(eventName, eventHandler);
            } else {
                super.on(eventName, eventHandler);
            }
        }

        if (typeof(eventName) === "string") {
            onSelfOrPlayer(eventName, eventHandler);
        } else {
            for (const name of eventName) {
                onSelfOrPlayer(name, eventHandler);
            }
        }
    }

    subscribe(paths: string[], callback: Function) {
        this.internalState.subscribe(paths, callback);
    }

    get playback(): PlaybackState {
        return this.internalState.playback;
    }

    get currentAudio(): AudioInfo | null {
        const audioInfo = this.playlist.find((audio: AudioInfo) => audio.uri === this.playback.currentAudio) || null;
        if (audioInfo !== null) {
            audioInfo.duration = this.player.duration;
        }
        return audioInfo;
    }

    get playlist(): AudioInfo[] {
        const playlist: AudioInfo[] = [];
        for (const audioUri of this.internalState.playlist) {
            playlist.push({
                uri: audioUri,
                title: "Unknown Title",
                artist: "Unknown Artist",
                album: "Unknown Album",
                duration: audioUri === this.playback.currentAudio ? this.player.duration : 1.0
            });
        }

        return playlist;
    }

    get fullPlaylist(): Promise<AudioInfo[]> {
        return new Promise(async (resolve, reject) => {
            const playlist: AudioInfo[] = [];
            for (const audioUri of this.internalState.playlist) {
                const audioInfo = await window.audioInfoCache.get(audioUri);
                if (audioInfo) {
                    playlist.push(audioInfo);
                } else {
                    playlist.push({
                        uri: audioUri,
                        title: "Unknown Title",
                        artist: "Unknown Artist",
                        album: "Unknown Album",
                        duration: 1
                    });
                }
            }
            resolve(playlist);
        });
    }

    get listeners(): ListenerInfo[] {
        const listeners: ListenerInfo[] = [];

        if (this.peer instanceof ListeningListener) {
            listeners.push({
                id: this.peer.hostId,
                name: "Host"
            });
            listeners.push({
                id: this.peer.id,
                name: "+You"
            })
        } else {
            listeners.push({
                id: this.peer.id,
                name: "You"
            });
        }

        const exclude = this.peer instanceof ListeningListener ? [this.peer.id, this.peer.hostId] : [this.peer.id];
        for (const listenerId of this.internalState.listeners.filter((id: string) => !exclude.includes(id))) {
            listeners.push({
                id: listenerId,
                name: "+1"
            });
        }
        
        return listeners;
    }

    get listeningState(): ListeningState {
        return this.internalState;
    }

    get player(): AudioPlayer {
        return window.player;
    }

    get invitationUrl(): string {
        return this.peer.invitationUrl;
    }
}