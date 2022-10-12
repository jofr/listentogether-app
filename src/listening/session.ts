import { MediaSession } from "@jofr/capacitor-media-session";

import { Events } from "../util/events";
import { ListeningHost, ListeningListener, ListeningPeer } from "./peer";
import { SyncableListeningState, ListeningState, StateSubscribable, StateSubscriptionFunction } from "./state";
import { AudioUri, CoverInfo } from "../metadata/types";
import { AudioPlayer } from "../player/audio_player";
import { logger } from "../util/logger";

export type SessionPlayback = {
    currentAudio: AudioUri | null,
    currentTime: number,
    playbackRate: number,
    paused: boolean
}

export type PromisedAudioInfo = {
    uri: AudioUri,
    title: Promise<string>,
    artist: Promise<string>,
    album: Promise<string>,
    duration: Promise<number>,
    cover: Promise<CoverInfo>
}

export type SessionPlaylist = PromisedAudioInfo[];

export type ListenerInfo = {
    id: string,
    name: string
}

/**
 * The session is the user (or UI) facing part of a listening. It combines state
 * and peer and provides functionality to change the state using actions and
 * operations one would expect from a media session (play, pause, skip, ...) and
 * forwards state change subscriptions to UI elements.
 *
 * Also uses the Media Session API of the system (either the Web API or the
 * Android API through the capacitor plugin) to provide metadata about the
 * current audio (e.g. for displaying media notifications) and to react to
 * hardware media keys (or software media keys from a media notification).
 *
 * A session should always be created using either the static function to create
 * a host ({@link ListeningSession#CreateHost}) or the one to create a listener
 * ({@link ListeningSession#CreateListener}) which set up the session with the
 * right peer for the two different roles.
 */
export class ListeningSession extends Events implements StateSubscribable {
    private state: SyncableListeningState;
    private peer: ListeningPeer;

    constructor(state: SyncableListeningState, peer: ListeningPeer) {
        super();

        this.state = state;
        this.peer = peer;

        this.mediaSessionAPISetup();

        // Implement auto play and skip to next track at the end of current one
        this.player.on(["ended"], this.skipNext.bind(this));
    }

    static CreateHost() {
        const state = new SyncableListeningState();
        const host = new ListeningHost(state);

        return new ListeningSession(state, host);
    }

    static CreateListener(hostId: string) {
        const state = new SyncableListeningState();
        const listener = new ListeningListener(hostId, state);

        return new ListeningSession(state, listener);
    }

    // If we are a listener and loose the connection to the host we transform
    // this session to a host session so that playback can continue using the
    // current state (albeit without synchronization to the other remaining
    // peers) and we can control that playback (if that was not allowed for
    // listeners before)
    transformToHost() {
        this.peer = new ListeningHost(this.state);
        window.session = window.session; /* TODO: triggers updates, solve this in a better way */
        this.emit("listenertohost");
    }

    destroy() {
        //this.peer.destroy(); TODO
    }

    on(eventName: string | string[], eventHandler: (...args: any[]) => void) {
        const playerEvents = ["audiochange", "timeupdate", "pause", "play", "durationchange", "buffering", "canplay"];

        const listenOnSelfOrPlayer = (eventName: string, eventHandler: (...args: any[]) => void) => {
            if (playerEvents.includes(eventName)) {
                this.player.on(eventName, eventHandler);
            } else {
                super.on(eventName, eventHandler);
            }
        }

        if (typeof(eventName) === "string") {
            listenOnSelfOrPlayer(eventName, eventHandler);
        } else {
            for (const name of eventName) {
                listenOnSelfOrPlayer(name, eventHandler);
            }
        }
    }

    subscribe(paths: string[], callback: StateSubscriptionFunction) {
        this.state.subscribe(paths, callback);
    }

    private mediaSessionAPISetup() {
        // Set up possible system media keys to initiate the desired action (for
        // the actions that are always possible and do not depend on some other
        // part of the state, e.g. skip next is only possible if there is a next
        // audio in the playlist, see updateMediaSessionActions below)
        MediaSession.setActionHandler({ action: "play" }, () => this.togglePlay("play"));
        MediaSession.setActionHandler({ action: "pause" }, () => this.togglePlay("pause"));
        MediaSession.setActionHandler({ action: "seekto" }, (details: MediaSessionActionDetails) => this.seek(details.seekTime));
        MediaSession.setActionHandler({ action: "seekbackward" }, () => this.replay());
        MediaSession.setActionHandler({ action: "seekforward" }, () => this.forward());
        MediaSession.setActionHandler({ action: "stop" }, () => this.stop());

        // Change media playback metadata through the Media Session API when
        // actual playback changes (not when the state itself changes because
        // that might not immediately change the actual playback and the media
        // notifications should synchronize with actual playback as experienced
        // by the user)
        this.player.on(["play", "pause", "durationchange", "seeked"], this.updateMediaSessionPlaybackState);

        // Current audio changes in the state change playback immediately so can
        // also be reflected immediately in the metadata provided to the system.
        // Current audio and playlist changes could also change some of the
        // possible actions (e.g. if skip next is possible) so those should be
        // updated immediately too.
        this.state.subscribe(["playback/currentAudio", "playlist"], this.updateMediaSessionActions);
        this.state.subscribe(["playback/currentAudio"], this.updateMediaSessionMetadata);
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
        const currentAudioUri = this.state.playback.currentAudio;
        const playlistIndex = this.state.playlist.findIndex((uri: AudioUri) => uri === currentAudioUri);
        const playlistLength = this.state.playlist.length;

        if (!currentAudioUri || playlistIndex === 0) {
            MediaSession.setActionHandler({ action: "previoustrack" }, null);
        } else {
            MediaSession.setActionHandler({ action: "previoustrack" }, () => this.skipPrevious());
        }

        if (!currentAudioUri || playlistIndex === (playlistLength - 1)) {
            MediaSession.setActionHandler({ action: "nexttrack" }, null);
        } else {
            MediaSession.setActionHandler({ action: "nexttrack" }, () => this.skipNext());
        }
    }

    private updateMediaSessionMetadata = async () => {
        const audioInfo = await window.metadataCache.getAudioInfo(this.state.playback.currentAudio);
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
                    sizes: "256x256", // TODO: actual size
                    type: "image/png" // TODO: actual file format
                }
            ]
        }
        MediaSession.setMetadata(mediaMetadata);
    }

    addAudio(audio: AudioUri) {
        if (this.state.playlist.includes(audio)) {
            logger.log(`Ignored request to add audio which is already in playlist: ${audio}`);
            return;
        }

        this.state.applyLocalChange((state: ListeningState) => {
            state.playlist.push(audio);
        });

        if (this.state.playback.currentAudio === null) {
            this.playAudio(audio);
        }
    }

    removeAudio(audio: AudioUri) {
        this.state.applyLocalChange((state: ListeningState) => {
            state.playlist.splice(state.playlist.indexOf(audio), 1);
        });
    }

    moveAudio(url: string, deltaIndex: number) {
        return;
    }

    playAudio(audio: AudioUri) {
        if (!this.state.playlist.includes(audio)) {
            logger.warn(`Ignored request to play audio which is not in playlist: ${audio}`);
            return;
        }

        this.state.applyLocalChange((state: ListeningState) => {
            state.playback.currentAudio = audio;
            state.playback.audioTime = 0;
            state.playback.referenceTime = Date.now();
        });
    }

    togglePlay(playState?: "play" | "pause") {
        this.state.applyLocalChange((state: ListeningState) => {
            state.playback.paused = playState ? (playState === "pause" ? true : false) : !state.playback.paused;
            state.playback.audioTime = this.player.currentTime;
            state.playback.referenceTime = Date.now();
        });
    }

    seek(time: number) {
        this.state.applyLocalChange((state: ListeningState) => {
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
        const index = this.state.playlist.indexOf(this.state.playback.currentAudio);
        if ((index - 1) >= 0) {
            this.playAudio(this.state.playlist[index - 1]);
        }
    }

    skipNext() {
        const index = this.state.playlist.indexOf(this.state.playback.currentAudio);
        if ((index + 1) < this.state.playlist.length) {
            this.playAudio(this.state.playlist[index + 1]);
        }
    }

    stop() {
        this.togglePlay("pause");
    }

    // Actual playback state in this peer and session (might be different from
    // internal state used for synchronization)
    get playback(): SessionPlayback {
        return {
            currentAudio: this.state.playback.currentAudio,
            currentTime: this.player.currentTime,
            playbackRate: this.player.playbackRate,
            paused: this.player.paused
        }
    }

    // Playlist enriched with metadata information (if available)
    get playlist(): SessionPlaylist {
        const playlist: SessionPlaylist = [];
        for (const audioUri of this.state.playlist) {
            const audioInfo = window.metadataCache.getAudioInfo(audioUri);
            const duration: Promise<number> = this.state.playback.currentAudio === audioUri
                                            ? new Promise((resolve) => resolve(this.player.duration))
                                            : audioInfo.then(info => info.duration);
            playlist.push({
                uri: audioUri,
                title: audioInfo.then(info => info.title),
                artist: audioInfo.then(info => info.artist),
                album: audioInfo.then(info => info.album),
                duration: duration,
                cover: audioInfo.then(info => info.cover)
            });
        }

        return playlist;
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
        for (const listenerId of this.state.listeners.filter((id: string) => !exclude.includes(id))) {
            listeners.push({
                id: listenerId,
                name: "+1"
            });
        }
        
        return listeners;
    }

    get player(): AudioPlayer {
        return window.player;
    }

    get listeningState(): SyncableListeningState {
        return this.state;
    }

    get listeningPeer(): ListeningPeer {
        return this.peer;
    }

    get invitationUrl(): string {
        return (this.peer as ListeningHost | ListeningListener).invitationUrl;
    }
}