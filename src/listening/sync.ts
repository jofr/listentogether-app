import { getDiff, rdiffResult } from "recursive-diff";

import { Events } from "../util/events";
import { AudioUri, ListenerId, ListeningState, PlaybackState } from "./state";
import { deepCopy } from "../util/util";

export type SyncMessage = {
    type: "playback" | "playlist" | "listeners",
    data: PlaybackState | AudioUri[] | ListenerId[]
}

type Subscription = {
    paths: string[],
    callback: Function
}

export class SyncedListeningState extends Events implements ListeningState {
    private internalState: ListeningState;
    private subscriptions: Subscription[] = [];

    constructor() {
        super();

        this.internalState = {
            playback: {
                currentAudio: null,
                referenceTime: 0,
                audioTime: 0,
                paused: true
            },
            playlist: [],
            listeners: []
        }
    }

    subscribe(paths: string[], callback: Function) {
        this.subscriptions.push({
            paths: paths,
            callback: callback
        });
    }

    private notifySubscribers(diffs: rdiffResult[]) {
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

    private mutateState(mutate: ((state: ListeningState) => void)) {
        const newInternalState = deepCopy(this.internalState);
        mutate(newInternalState);
        const diffs = getDiff(this.internalState, newInternalState);
        this.internalState = newInternalState;
        this.notifySubscribers(diffs);
    }

    applySyncMessage(message: SyncMessage) {
        this.mutateState((state: ListeningState) => {
            (state[message.type] as PlaybackState | string[]) = message.data;
        });
        this.emit("synced");
    }

    applyChange(mutate: ((state: ListeningState) => void)) {
        this.mutateState(mutate);
        this.emit("changed");
    }

    get playback(): PlaybackState {
        return this.internalState.playback;
    }

    get playlist(): AudioUri[] {
        return this.internalState.playlist;
    }

    get listeners(): ListenerId[] {
        return this.internalState.listeners;
    }
}