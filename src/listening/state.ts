import { getDiff, rdiffResult } from "recursive-diff";

import { arraysEqual, deepCopy } from "../util/util";
import { Events } from "../util/events";
import { PeerId } from "./peer";
import { AudioUri } from "../metadata/types";

export type PlaybackState = {
    currentAudio: AudioUri | null,
    referenceTime: number,
    audioTime: number,
    playbackRate: number,
    paused: boolean
}

export type ListeningState = {
    playback: PlaybackState,
    playlist: AudioUri[],
    listeners: PeerId[]
}

export type PlaybackStateSyncMessage = {
    type: "playback",
    data: PlaybackState
}

export type PlaylistStateSyncMessage = {
    type: "playlist",
    data: AudioUri[]
}

export type ListenersStateSyncMessage = {
    type: "listeners",
    data: PeerId[]
}

export type StateSyncMessage =
    PlaybackStateSyncMessage | PlaylistStateSyncMessage | ListenersStateSyncMessage;

export type StateSubscriptionFunction = () => void;

export interface StateSubscribable {
    subscribe: (paths: string[], callback: StateSubscriptionFunction) => void;
}

type StateMutationFunction = (state: ListeningState) => void;

type Subscription = {
    paths: string[],
    callback: StateSubscriptionFunction
}

/**
 * Mutable and syncable state of a listening. State can be changed locally using
 * {@link SyncableListeningState#applyLocalChange} or by applying a sync message
 * using {@link SyncableListeningState#applySyncMessage}. Whenever state is
 * changed (either locally or via sync message) every subscriber interested in
 * those changes gets notified (if they have subscribed to the relevant parts of
 * the state with {@link SyncableListeningState#subscribe}). If a local change
 * updates the state a {@link StateSyncMessage} gets prepared and emitted via
 * the "syncmessage" event.
 *
 * This class does neither handle the actual exchange of sync messages nor does
 * it check authorization. It just provides dumb functions for applying changes,
 * subscribing to parts of the state and emitting sync messages if something
 * gets changed locally. The actual message exchange has to be implemented in a
 * layer on top of that (and is done so in {@link ListeningPeer}). This layer
 * has to know about other copies of the state (that want to be synced) and has
 * to make sure they get every sync message (in the right order) and could also
 * enforce authorization rules (e.g. denying the application of certain sync
 * messages if the originator of that message is not authorized to change the
 * state in that way).
 *
 * In this sync model the state basically consists of three Last-Writer-Wins
 * Registers (playback, listeners and playlist) that get updated using the three
 * corresponding sync message types ({@link PlaybackStateSyncMessage},
 * {@link ListenersStateSyncMessage} and {@link PlaylistStateSyncMessage}). In
 * contrast to most CRDTs the decision who the last writer is does not get
 * solved using some form of CRDT timestamp (Lamport, etc.) but by the order the
 * messages arrive at the host of the listening. This client/server topology is
 * choosen because it also significantly reduces the problem of deciding whose
 * state changes are authorized (the host decides).
 *
 * TODO: While a Last-Writer-Wins Register seems to be a good model for
 * listeners and playback state (we want exactly the same playback state on
 * every peer; just syncing the whole state instead of specific changes does not
 * introduce much overhead but keeps it simple) it is not optimal for a playlist
 * that gets possibly modified across several peers.
 */
export class SyncableListeningState extends Events implements ListeningState, StateSubscribable {
    private state: ListeningState = {
        playback: {
            currentAudio: null,
            referenceTime: 0.0,
            audioTime: 0.0,
            playbackRate: 1.0,
            paused: true
        },
        playlist: [],
        listeners: []
    };
    private subscriptions: Subscription[] = [];

    subscribe(paths: string[], callback: StateSubscriptionFunction): void {
        this.subscriptions.push({
            paths: paths,
            callback: callback
        });
    }

    unsubscribe(paths: string[], callback: StateSubscriptionFunction): void {
        for (const [index, subscribtion] of this.subscriptions.entries()) {
            if (arraysEqual(subscribtion.paths, paths) && subscribtion.callback === callback) {
                this.subscriptions.splice(index, 1);
                break;
            }
        }
    }

    private notifySubscribers(diffs: rdiffResult[]): void {
        const callbacks: Set<Function> = new Set<Function>();
        for (const diff of diffs) {
            const diffPath = diff.path.join("/");
            for (const subscription of this.subscriptions) {
                for (const path of subscription.paths) {
                    const index = diffPath.indexOf(path);
                    if (index === 0) {
                        callbacks.add(subscription.callback);
                    }
                }
            }
        }

        for (const callback of callbacks) {
            callback();
        }
    }

    private mutateState(mutate: StateMutationFunction): rdiffResult[] {
        const newState = deepCopy(this.state);
        mutate(newState);
        const diffs = getDiff(this.state, newState);
        this.state = newState;

        this.notifySubscribers(diffs);

        return diffs;
    }

    applySyncMessage(message: StateSyncMessage): void {
        this.mutateState((state: ListeningState) => {
            (state[message.type] as PlaybackState | AudioUri[] | PeerId[]) = message.data;
        });
        this.emit("synced");
    }

    applyLocalChange(mutate: StateMutationFunction): void {
        const diffs = this.mutateState(mutate);
        this.emit("changed");

        // Emit every necessary sync message to cover all changed parts of state
        const syncMessageTypes: Set<string> = new Set<string>;
        for (const diff of diffs) {
            const diffPath = diff.path.join("/");
            for (const type of ["playback", "playlist", "listeners"]) {
                if (diffPath.indexOf(type) === 0) {
                    syncMessageTypes.add(type);
                }
            }
        }
        for (const type of syncMessageTypes) {
            this.emit("syncmessage", {
                type: type,
                data: this.state[type]
            });
        }
    }

    get playback(): PlaybackState {
        return this.state.playback;
    }

    get playlist(): AudioUri[] {
        return this.state.playlist;
    }

    get listeners(): PeerId[] {
        return this.state.listeners;
    }
}