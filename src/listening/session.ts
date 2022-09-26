import { MediaSession } from "@jofr/capacitor-media-session";

import { Events } from "../util/events";
import { SyncedListeningState } from "./synced_state";
import { ListeningHost, ListeningListener } from "./peer";
import { AudioUri, ListeningState, PlaybackState } from "./state";
import { AudioInfo } from "../metadata/types";
import { AudioPlayer } from "../player/audio_player";
import { logger } from "../util/logger";
import { state } from "lit/decorators";

export type ListenerInfo = {
    id: string,
    name: string
}

export class ListeningSession extends Events {
    constructor(private internalState: SyncedListeningState, public peer: ListeningHost | ListeningListener) {
        super();

        MediaSession.setActionHandler({ action: "play" }, () => this.togglePlay("play"));
        MediaSession.setActionHandler({ action: "pause" }, () => this.togglePlay("pause"));
        MediaSession.setActionHandler({ action: "seekto" }, (details: MediaSessionActionDetails) => this.seek(details.seekTime));
        MediaSession.setActionHandler({ action: "seekbackward" }, () => this.replay());
        MediaSession.setActionHandler({ action: "seekforward" }, () => this.forward());
        MediaSession.setActionHandler({ action: "stop" }, () => this.stop());

        this.player.on(["play", "pause", "durationchange", "seeked"], this.updateMediaSessionPlaybackState);
        this.player.on(["ended"], this.skipNext.bind(this));
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

    destroy() {
        this.peer.destroy();
    }

    transformToHost() {
        this.peer = new ListeningHost(this.internalState);
        window.session = window.session; /* TODO: triggers updates, solve this in a better way */
        this.emit("listenertohost");
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
        const audioInfo = await window.metadataCache.getAudioInfo(this.currentAudio.uri);
        const mediaMetadata: MediaMetadataInit = {
            title: audioInfo.title,
            artist: audioInfo.artist,
            album: audioInfo.album,
            artwork: []
        }
        if (audioInfo.cover) {
            mediaMetadata.artwork = [
                {
                    src: audioInfo.cover.url || audioInfo.cover.objectUrl || audioInfo.cover.dataUrl,
                    sizes: "256x256",
                    type: "image/png"
                }
            ]
        }
        MediaSession.setMetadata(mediaMetadata);
    }

    addAudio(audio: AudioUri) {
        if (this.internalState.playlist.includes(audio)) {
            logger.log(`Ignored request to add audio which is already in playlist: ${audio}`);
            return;
        }

        this.internalState.applyChange((state: ListeningState) => {
            state.playlist.push(audio);
        });

        if (this.internalState.playback.currentAudio === null) {
            this.playAudio(audio);
        }
    }

    removeAudio(audio: AudioUri) {
        this.internalState.applyChange((state: ListeningState) => {
            state.playlist.splice(state.playlist.indexOf(audio), 1);
        });
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

    stop() {
        this.togglePlay("pause");
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
                const audioInfo = await window.metadataCache.getAudioInfo(audioUri);
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