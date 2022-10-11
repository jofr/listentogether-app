import { nanoid } from "nanoid";

import { Events } from "../util/events";
import { logger } from "../util/logger";
import { createInvitationUrl } from "../util/util";
import { SignalingConnection, SignalingMessage } from "../webrtc/signaling_connection";
import { PeerId, PeerConnection, CallerPeerConnection, CalleePeerConnection, PeerConnectionOptions } from "../webrtc/peer_connection";
import { ListeningState } from "./state";
import { SyncedListeningState, SyncMessage } from "./synced_state";
import { AudioInfo } from "../metadata/types";

import config from "../../config.json";

export enum ConnectionState {
    CONNECTING, CONNECTED, CLOSED, ERROR
}

/**
 * A peer of a listening (which is the virtual room in which several peers
 * listen to the same audios). This class provides the common functionality
 * between host and listener but needs not to be used directly, instead the
 * {@link ListeningHost} and {@link ListeningListener} classes should be used
 * depending on the role of the peer.
 *
 * Each peer has a local copy of the current listening state and synchronizes
 * this state with the other peers in the listening. At the moment this is done
 * using a client/server topology where the {@link ListeningHost} (always the
 * initiator of the listening) updates the other {@link ListeningListener} peers
 * (which might request updates to the state from the host, but the host
 * ultimately decides if those are allowed and will be replicated from the host
 * to the other listeners).
 */
export class ListeningPeer extends Events {
    readonly id: PeerId = nanoid();
    private signalingConnection: SignalingConnection;
    protected acceptIncomingConnections = true;
    protected peerConnections: Map<PeerId, PeerConnection> = new Map<PeerId, PeerConnection>();
    protected state: SyncedListeningState;

    constructor(state: SyncedListeningState) {
        super();

        this.state = state;
        this.signalingConnection = new SignalingConnection({
            peerId: this.id,
            host: config.signalingHost,
            port: config.signalingPort
        });
        this.signalingConnection.on("message", this.signalingMessage);
    }

    private peerConnectionOptions(peerId: PeerId): PeerConnectionOptions {
        return {
            signalingConnection: this.signalingConnection,
            remoteId: peerId,
            stunHost: config.stunHost,
            stunPort: config.stunPort,
            turnHost: config.turnHost,
            turnPort: config.turnPort
        }
    }

    private peerConnectionSetup(peerConnection: PeerConnection): void {
        this.peerConnections.set(peerConnection.remoteId, peerConnection);
        peerConnection.on("connected", () => this.emit("connection", peerConnection));
        peerConnection.on("closed", () => this.peerConnections.delete(peerConnection.remoteId))
    }

    // Receiving an SDP description message over the signaling connection from
    // an unknown peer id means that this is a new peer that wants to connect
    // with us. So if we accept incoming connections we create a new peer
    // connection (which then handles the connection negotiation).
    private signalingMessage = (message: SignalingMessage) => {
        if (!this.acceptIncomingConnections) {
            return;
        }

        if (message.type === "description" && !this.peerConnections.has(message.from)) {
            const remoteId = message.from;
            const peerConnection = new CalleePeerConnection(this.peerConnectionOptions(remoteId));
            this.peerConnectionSetup(peerConnection);
        }
    }

    protected connectToPeer(peerId: PeerId): void {
        if (this.peerConnections.has(peerId)) {
            return;
        }

        const peerConnection = new CallerPeerConnection(this.peerConnectionOptions(peerId));
        this.peerConnectionSetup(peerConnection);
    }

    protected async syncMessage(connection: PeerConnection, message: SyncMessage) {
        if (message.type === "audioinforequest") {
            const audioInfo = await window.metadataCache.getAudioInfo(message.data.uri);
            if (audioInfo !== null) {
                connection.sendMessage({
                    type: "audioinfo",
                    data: audioInfo
                });
            }
        }
    }

    protected sendSyncToPeers(type: string, peers?: PeerId[]) {
        const connections = peers === undefined
                          ? this.peerConnections.values()
                          : Array.from(this.peerConnections.values()).filter(c => peers.includes(c.remoteId));

        for (const connection of connections) {
            connection.sendMessage({
                type: type,
                data: this.state[type]
            });
        }
    }
}

export class ListeningHost extends ListeningPeer {
    constructor(state: SyncedListeningState) {
        super(state);

        // We cannot make any assumptions about the state used to construct a
        // host (e.g. if a listener disconnects it gets transformed into a host
        // and reuses the previous state so that the listener can continue
        // listening to the playlist even though the connection to the original
        // host has been lost). So we need to make sure that the listeners
        // property of the host is correctly initialized here.
        this.state.applyChange((state: ListeningState) => {
            state.listeners = [];
            state.listeners.push(this.id);
        });

        this.on("connection", this.listenerConnected);

        // Whenever part of the state changes send an according sync message to
        // all connected peers
        this.state.subscribe(["listeners"], () => this.sendSyncToPeers("listeners"));
        this.state.subscribe(["playlist"], () => this.sendSyncToPeers("playlist"));
        this.state.subscribe(["playback"], () => this.sendSyncToPeers("playback"));
    }

    private listenerConnected = (peerConnection: PeerConnection) => {
        // Optimistically assume that a data channel will also succesfully be opened
        // if the connection to the peer is established and already change state
        // accordingly...
        this.state.applyChange((state: ListeningState) => {
            state.listeners.push(peerConnection.remoteId);
        });

        // ...and prepare first sync messages to the new peer (which get queued
        // in the PeerConnection until the data channel is actually ready) to
        // get it up to speed.
        this.sendSyncToPeers("listeners", [peerConnection.remoteId]);
        this.sendSyncToPeers("playlist", [peerConnection.remoteId]);
        this.sendSyncToPeers("playback", [peerConnection.remoteId]);

        peerConnection.on("closed", () => this.listenerConnectionClosed(peerConnection.remoteId));
        peerConnection.on("message", (message: SyncMessage) => this.syncMessage(peerConnection, message));
    }

    private listenerConnectionClosed(peerId: PeerId) {
        this.state.applyChange((state: ListeningState) => {
            const index = state.listeners.indexOf(peerId);
            state.listeners.splice(index, 1);
        });
    }

    get invitationUrl(): string {
        return createInvitationUrl(this.id);
    }
}

export class ListeningListener extends ListeningPeer {
    private hostConnection: PeerConnection;
    private resolveAudioInfoRequests: Map<string, Function> = new Map<string, Function>();
    hostConnectionState: ConnectionState = ConnectionState.CONNECTING;

    constructor (hostId: PeerId, state: SyncedListeningState) {
        super(state);

        console.log("connect to peer", hostId)
        this.connectToPeer(hostId);
        console.log(this.peerConnections)
        this.hostConnection = this.peerConnections.get(hostId);

        this.hostConnection.on("connected", this.hostConnected);
        this.hostConnection.on("closed", this.hostConnectionClosed);
        this.hostConnection.on("message", (message: SyncMessage) => this.syncMessage(this.hostConnection, message));

        setTimeout(() => {
            if (this.hostConnectionState === ConnectionState.CONNECTING) {
                this.hostConnectionState = ConnectionState.ERROR;
                this.emit("hostconnectionstate");
            }
        }, 10000);
    }

    private hostConnected = (): void => {
        this.hostConnectionState = ConnectionState.CONNECTED;
        this.emit("hostconnectionstate");
    }

    private hostConnectionClosed = (): void => {
        this.hostConnectionState = ConnectionState.CLOSED;
        window.session.transformToHost();
        this.emit("hostconnectionstate");
    }

    protected async syncMessage (connection: PeerConnection, message: SyncMessage) {
        super.syncMessage(connection, message);

        if (["playback", "playlist", "listeners"].includes(message.type)) {
            this.state.applySyncMessage(message);
        } else if (message.type === "audioinfo") {
            if (this.resolveAudioInfoRequests.has(message.data.uri)) {
                this.resolveAudioInfoRequests.get(message.data.uri)(message.data as AudioInfo);
            }
        }
    }

    requestAudioInfoFromHost(uri: string): Promise<AudioInfo | null> {
        let resolveAudioInfo: (value: AudioInfo | PromiseLike<AudioInfo>) => void;
        const audioInfoPromise = new Promise<AudioInfo | null>((resolve, reject) => resolveAudioInfo = resolve);
        this.resolveAudioInfoRequests.set(uri, resolveAudioInfo);

        this.hostConnection.sendMessage({
            type: "audioinforequest",
            data: {
                uri: uri
            }
        });

        return audioInfoPromise;
    }

    get invitationUrl(): string {
        return createInvitationUrl(this.hostConnection.remoteId);
    }
}