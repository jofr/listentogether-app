import Peer, { DataConnection } from "peerjs";

import { Events } from "../util/events";
import { ListenerId, ListeningState } from "./state";
import { SyncedListeningState, SyncMessage } from "./synced_state";
import { logger } from "../util/logger";
import { AudioInfo } from "../metadata/types";

import config from "../../config.json";

export enum ConnectionState {
    CONNECTING, CONNECTED, CLOSED, ERROR
}

type PeerId = string;

class PeerConnection extends Events {
    private connection: RTCPeerConnection;
    private dataChannel: RTCDataChannel | null;

    constructor(readonly peerId: PeerId) {
        super();

        this.connection = new RTCPeerConnection();
        this.connection.addEventListener("icecandidate", (event: RTCPeerConnectionIceEvent) => this.emit("icecandidate", event.candidate));
        this.connection.addEventListener("connectionstatechange", (event: Event) => {
            if (this.connection.connectionState === "connected") {
                this.emit("connected");
            }
        })
        //this.connection.addEventListener("negotiationneeded")
    }

    dataChannelSetup() {
        this.dataChannel.addEventListener("open", () => this.emit("open"));
        this.dataChannel.addEventListener("message", (event: MessageEvent) => this.emit("message", JSON.parse(event.data)));
    }

    static Caller(peerId: PeerId) {
        const peerConnection = new PeerConnection(peerId);
        peerConnection.dataChannel = peerConnection.connection.createDataChannel("sync");
        peerConnection.dataChannelSetup();

        return peerConnection;
    }

    static Callee(peerId: PeerId) {
        const peerConnection = new PeerConnection(peerId);
        peerConnection.connection.addEventListener("datachannel", (event: RTCDataChannelEvent) => {
            peerConnection.dataChannel = event.channel;
            peerConnection.dataChannelSetup();
        });

        return peerConnection;
    }

    async createOffer(): Promise<RTCSessionDescriptionInit> {
        const offer = await this.connection.createOffer();
        this.connection.setLocalDescription(offer);

        return offer;
    }

    async applyOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        this.connection.setRemoteDescription(offer);
        const answer = await this.connection.createAnswer();
        this.connection.setLocalDescription(answer);

        return answer;
    }

    applyAnswer(answer: RTCSessionDescriptionInit) {
        this.connection.setRemoteDescription(answer);
    }

    applyIceCandidate(candidate: RTCIceCandidate) {
        this.connection.addIceCandidate(candidate);
    }

    send(message: any) {
        this.dataChannel.send(JSON.stringify(message));
    }
}

class ListeningPeer extends Events {
    readonly id: PeerId = Math.floor(Math.random()*2**18).toString(36).padStart(4,'0');
    private signalingSocket: WebSocket;
    protected peerConnections: Map<PeerId, PeerConnection> = new Map<PeerId, PeerConnection>();
    protected state: SyncedListeningState;

    constructor(state: SyncedListeningState) {
        super();

        this.signalingSocket = new WebSocket(`ws://localhost:5000?version=1&id=${this.id}`),
        this.signalingSocket.addEventListener("open", () => this.peerSetup())
        this.signalingSocket.addEventListener("message", this.receiveSignalingMessage);
        this.state = state;
    }

    protected peerSetup() {
        this.on("connection", (id: PeerId) => console.log(`New connection from ${id}`));
    }

    private receiveSignalingMessage = async (event: MessageEvent) => {
        const message = JSON.parse(event.data);
        const peerId = message.from;
        if (!peerId) {
            return;
        }

        let peerConnection = this.peerConnections.get(peerId);

        if (message.type === "offer") {
            if (!peerConnection) {
                peerConnection = PeerConnection.Callee(peerId);
                peerConnection.on("icecandidate", (candidate: RTCIceCandidate) => this.sendICECandidate(message.from, candidate));
                peerConnection.on("connected", () => this.emit("connection", peerId));
                this.peerConnections.set(peerId, peerConnection);
            }

            const offer = message.data;
            const answer = await peerConnection.applyOffer(offer);
            this.sendSignalingMessage({
                type: "answer",
                from: this.id,
                to: peerId,
                data: answer
            });
        } else if (message.type === "answer" && peerConnection) {
            const answer = message.data;
            peerConnection.applyAnswer(answer);
        } else if (message.type === "icecandidate" && peerConnection) {
            const iceCandidate = message.data;
            peerConnection.applyIceCandidate(iceCandidate);
        }
    }

    private sendSignalingMessage(message: any) {
        if (this.signalingSocket.readyState === WebSocket.OPEN) {
            this.signalingSocket.send(JSON.stringify(message));
        }
    }

    private sendICECandidate(peerId: string, candidate: RTCIceCandidate) {
        this.sendSignalingMessage({
            type: "icecandidate",
            from: this.id,
            to: peerId,
            data: candidate
        });
    }

    protected async connectToPeer(peerId: string) {
        if (this.peerConnections.has(peerId)) {
            return;
        }

        const peerConnection = PeerConnection.Caller(peerId);
        peerConnection.on("icecandidate", (candidate: RTCIceCandidate) => this.sendICECandidate(peerId, candidate));
        this.peerConnections.set(peerId, peerConnection);
        const offer = await peerConnection.createOffer();
        this.sendSignalingMessage({
            type: "offer",
            from: this.id,
            to: peerId,
            data: offer
        });
    }
}


window.peerA = new ListeningPeer(new SyncedListeningState());
window.peerB = new ListeningPeer(new SyncedListeningState());



export class ListeningHost extends ListeningPeer {
    private listenerConnections: Set<DataConnection> = new Set<DataConnection>();

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
        logger.log(`Connection to listener ${connection.peerId} open`);

        this.state.applyChange((state: ListeningState) => {
            state.listeners.push(connection.peerId);
        });

        this.sendSyncToListeners("playlist", [connection.peerId]);
        this.sendSyncToListeners("playback", [connection.peerId]);
    }

    private deleteConnection(connection: PeerConnection) {
        this.state.applyChange((state: ListeningState) => {
            const index = state.listeners.indexOf(connection.peerId);
            state.listeners.splice(index, 1);
        });

        //this.listenerConnections.delete(connection); TODO
    }

    private connectionClosed = (connection: PeerConnection): void => {
        //this.deleteConnection(connection); // TODO

        logger.log(`Connection to listener ${connection.peerId} closed`);
    }

    private connectionError = (connection: PeerConnection, error: any): void => {
        //this.deleteConnection(connection); // TODO

        logger.log(`Error in connection to listener ${connection.peerId}:`, error);
    }

    private applySyncMessage = async (connection: PeerConnection, message: any) => {
        logger.log("Received sync message:", message);

        if (message.type == "audioinforequest") {
            const audioInfo = await window.metadataCache.getAudioInfo(message.data.uri);
            connection.send({
                type: "audioinfo",
                data: audioInfo
            });
        }
    }

    private sendSyncToListeners = (type: string, listeners?: ListenerId[]) => {
        const listenerConnections = listeners === undefined
                                  ? this.peerConnections.values()
                                  : Array.from(this.peerConnections.values()).filter((connection: PeerConnection) => listeners.includes(connection.peerId));
        for (const connection of listenerConnections) {
            //if (connection.open) {
                connection.send({
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
        }, 5000);
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
            this.hostConnection.send({
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