import { Events } from "../util/events";
import { logger } from "../util/logger";
import { SignalingConnection } from "../webrtc/signaling_connection";
import { PeerId, PeerConnection, PeerConnectionCaller, PeerConnectionCallee } from "../webrtc/peer_connection";

import { ListenerId, ListeningState } from "./state";
import { SyncedListeningState, SyncMessage } from "./synced_state";
import { AudioInfo } from "../metadata/types";

import config from "../../config.json";

export enum ConnectionState {
    CONNECTING, CONNECTED, CLOSED, ERROR
}

class ListeningPeer extends Events {
    readonly id: PeerId = Math.floor(Math.random()*2**18).toString(36).padStart(4,'0');
    private signalingConnection: SignalingConnection;
    protected peerConnections: Map<PeerId, PeerConnection> = new Map<PeerId, PeerConnection>();
    protected state: SyncedListeningState;

    constructor(state: SyncedListeningState) {
        super();

        this.signalingConnection = new SignalingConnection({
            peerId: this.id,
            host: config.signalingHost,
            port: config.signalingPort
        });
        this.signalingConnection.on("message", (message: any) => {
            if (message.type === "description" && !this.peerConnections.has(message.from)) {
                const peerConnection = new PeerConnectionCallee({
                    signalingConnection: this.signalingConnection,
                    remoteId: message.from,
                    stunHost: config.stunHost,
                    stunPort: config.stunPort,
                    turnHost: config.turnHost,
                    turnPort: config.turnPort
                });
                peerConnection.on("connected", () => this.emit("connection", peerConnection.remoteId));
                this.peerConnections.set(message.from, peerConnection);
            }
        });
        this.state = state;

        setTimeout(() => this.peerSetup(), 0);
    }

    protected peerSetup() {

    }

    protected async connectToPeer(peerId: string) {
        if (this.peerConnections.has(peerId)) {
            return;
        }

        const peerConnection = new PeerConnectionCaller({
            signalingConnection: this.signalingConnection,
            remoteId: peerId,
            stunHost: config.stunHost,
            stunPort: config.stunPort,
            turnHost: config.turnHost,
            turnPort: config.turnPort
        });
        this.peerConnections.set(peerId, peerConnection);
    }
}

export class ListeningHost extends ListeningPeer {
    protected peerSetup(): void {
        /* Setup is only necessary once, but peerSetup gets called again in case of a dis- and reconnect */
        if (this.state.listeners.includes(this.id)) {
            return;
        }

        this.state.applyChange((state: ListeningState) => {
            state.listeners = [];
            state.listeners.push(this.id);
        });

        this.on("connection", this.listenerConnected);

        this.state.subscribe(["listeners"], () => this.sendSyncToListeners("listeners"));
        this.state.subscribe(["playlist"], () => this.sendSyncToListeners("playlist"));
        this.state.subscribe(["playback"], () => this.sendSyncToListeners("playback"));
    }

    private listenerConnected = (peerId: PeerId) => {
        const peerConnection = this.peerConnections.get(peerId);
        peerConnection.on("open", () => this.connectionOpen(peerConnection));
        peerConnection.on("close", () => this.connectionClosed(peerConnection));
        peerConnection.on("error", (error: any) => this.connectionError(peerConnection, error));
        peerConnection.on("message", (message: any) => this.applySyncMessage(peerConnection, message));
    }

    private connectionOpen = (connection: PeerConnection): void => {
        logger.log(`Connection to listener ${connection.remoteId} open`);

        this.state.applyChange((state: ListeningState) => {
            state.listeners.push(connection.remoteId);
        });

        this.sendSyncToListeners("playlist", [connection.remoteId]);
        this.sendSyncToListeners("playback", [connection.remoteId]);
    }

    private deleteConnection(connection: PeerConnection) {
        this.state.applyChange((state: ListeningState) => {
            const index = state.listeners.indexOf(connection.remoteId);
            state.listeners.splice(index, 1);
        });

        //this.listenerConnections.delete(connection); TODO
    }

    private connectionClosed = (connection: PeerConnection): void => {
        //this.deleteConnection(connection); // TODO

        logger.log(`Connection to listener ${connection.remoteId} closed`);
    }

    private connectionError = (connection: PeerConnection, error: any): void => {
        //this.deleteConnection(connection); // TODO

        logger.log(`Error in connection to listener ${connection.remoteId}:`, error);
    }

    private applySyncMessage = async (connection: PeerConnection, message: any) => {
        logger.log("Received sync message:", message);

        if (message.type == "audioinforequest") {
            const audioInfo = await window.metadataCache.getAudioInfo(message.data.uri);
            connection.sendMessage({
                type: "audioinfo",
                data: audioInfo
            });
        }
    }

    private sendSyncToListeners = (type: string, listeners?: ListenerId[]) => {
        const listenerConnections = listeners === undefined
                                  ? this.peerConnections.values()
                                  : Array.from(this.peerConnections.values()).filter((connection: PeerConnection) => listeners.includes(connection.remoteId));
        for (const connection of listenerConnections) {
            //if (connection.open) {
                connection.sendMessage({
                    type: type,
                    data: this.state[type]
                });
            //} else {
            //    logger.warn(`Tried sending sync but connection to listener ${connection.peer} not open`);
            //} TODO
        }
    }

    get invitationUrl(): string {
        //return this.createInvitationUrl(this.peer.id); TODO
        return "foo";
    }
}

export class ListeningListener extends ListeningPeer {
    private hostConnection: PeerConnection;
    private audioInfoRequests: Map<string, Function> = new Map<string, Function>();
    connectionState: ConnectionState = ConnectionState.CONNECTING;

    constructor (readonly hostId: string, state: SyncedListeningState) {
        super(state);
    }

    protected peerSetup(): void {
        this.connectToPeer(this.hostId);
        this.hostConnection = this.peerConnections.get(this.hostId);
        this.hostConnection.on("open", this.connectionOpen);
        this.hostConnection.on("close", this.connectionClosed);
        this.hostConnection.on("error", this.connectionError);
        this.hostConnection.on("message", this.applySyncMessage);

        setTimeout(() => {
            if (this.connectionState === ConnectionState.CONNECTING) {
                this.connectionState = ConnectionState.ERROR;
                this.emit("connectionchange");
            }
        }, 15000);
    }

    private connectionOpen = (): void => {
        logger.log(`Connection to host ${this.hostId} open:`, this.hostConnection);

        this.connectionState = ConnectionState.CONNECTED;
        this.emit("connectionchange");
    }

    private connectionClosed = (): void => {
        logger.log(`Connection to host ${this.hostId} closed`);

        this.connectionState = ConnectionState.CLOSED;

        window.session.transformToHost();

        this.emit("connectionchange");
    }

    private connectionError = (error: any): void => {
        logger.log(`Error in connection tho host ${this.hostId}:`, error);

        this.connectionState = ConnectionState.ERROR;
        this.emit("connectionchange");
    }

    private applySyncMessage = (message: any) => {
        logger.log("Received sync message:", message);

        if (["playback", "playlist", "listeners"].includes(message.type)) {
            this.state.applySyncMessage(message as SyncMessage);
        } else if (message.type == "audioinfo") {
            if (this.audioInfoRequests.has(message.data.uri)) {
                this.audioInfoRequests.get(message.data.uri)(message.data as AudioInfo);
            }
        }
    }

    requestAudioInfoFromHost(uri: string): Promise<AudioInfo | null> {
        let resolveAudioInfo: (value: AudioInfo | PromiseLike<AudioInfo>) => void;
        const audioInfoPromise = new Promise<AudioInfo | null>((resolve, reject) => resolveAudioInfo = resolve);
        this.audioInfoRequests.set(uri, resolveAudioInfo);

        //if (this.hostConnection.open) {
            this.audioInfoRequests.set(uri, resolveAudioInfo);
            this.hostConnection.sendMessage({
                type: "audioinforequest",
                data: {
                    uri: uri
                }
            });
        //} else {
        //    resolveAudioInfo(null);
        //}

        return audioInfoPromise;
    }

    get invitationUrl(): string {
        //return this.createInvitationUrl(this.hostId);
        return "foo"
    }
}