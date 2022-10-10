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

type SignalingMessage = {
    type: "description" | "icecandidate",
    from?: PeerId,
    to: PeerId,
    data: any
}

/**
 * Connection to a signaling server. Used to exchange control messages with
 * other peers (connected to the same signaling server) to establish direct
 * WebRTC connections between two peers ({@link PeerConnection} uses the
 * signaling connection for that purpose).
 *
 * Signaling messages should be of type {@link SignalingMessage} and are send
 * and received as JSON strings.
 *
 * Upon connection the {@link PeerId} is claimed and the server associates this
 * connection as the only valid connection to send messages on behalf of that
 * peer (and only of that peer), so one connection per peer is needed.
 */
class SignalingConnection extends Events {
    readonly peerId: PeerId;
    private signalingSocket: WebSocket;
    private messageQueue: string[] = [];

    constructor(peerId: PeerId) {
        super();

        this.peerId = peerId;
        this.signalingSocket = new WebSocket(`wss://${config.signalingHost}:${config.signalingPort}?version=1&id=${this.peerId}`),
        this.signalingSocket.addEventListener("open", () => {
            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                this.signalingSocket.send(message);
                logger.log("Send enqueued signaling message: ", JSON.parse(message));
            }
        });
        this.signalingSocket.addEventListener("message", this.receiveMessage);
        this.signalingSocket.addEventListener("close", (event: CloseEvent) => {
            if (event.code >= 4000 && event.code <= 4002) {
                logger.error(`Signaling connection for peer ${this.peerId} closed because peer id is either taken, missing or invalid`);
            } else {
                logger.error(`Signaling connection for peer ${this.peerId} closed with code ${event.code} (${event.reason})`);
            }
        });
        this.signalingSocket.addEventListener("error", (event: Event) => {
            logger.error("Signaling connection error: ", event);
        });
    }

    private receiveMessage = (event: MessageEvent) => {
        try {
            const message = JSON.parse(event.data);
            const fromId = message.from;
            if (fromId === undefined) throw new Error("Field 'from' missing in signaling message");
            logger.log("Received signaling message: ", message);
            this.emit("message", message);
            this.emit(`messagefrom:${fromId}`, message);
        } catch (error) {
            logger.warn("Received malformed signaling message: ", event.data);
        }
    }

    sendMessage(message: SignalingMessage) {
        if (this.signalingSocket.readyState === WebSocket.OPEN) {
            this.signalingSocket.send(JSON.stringify(message));
            logger.log("Send signaling message: ", message);
        } else {
            this.messageQueue.push(JSON.stringify(message));
        }
    }
}

/**
 * Bidirectional WebRTC connection and data channel between two peers. Needs the
 * {@link SignalingConnection} for the local peer to establish and negotiate the
 * WebRTC connection with the remote peer. Handles negotiation according to the
 * perfect negotiation pattern as [defined in the WebRTC specification (§
 * 10.7)](@link https://www.w3.org/TR/webrtc/#perfect-negotiation-example).
 *
 * Messages on the data channel need to be serializable to JSON and are send and
 * received as JSON strings.
 *
 * Emits a "connected" event as soon as the peer-to-peer connection is
 * established and an "open" event as soon as the data channel is open (but
 * messages can be send before that and will get queued and send as soon as the
 * data channel is open).
 *
 * Normally {@link PeerConnection} does not need to be used directly, but
 * instead {@link PeerConnectionCallee} or {@link PeerConnectionCaller} should
 * be used depending on wether the peer is initiating the connection (so is the
 * caller) or the peer is aware of a connection attempt to itself (so is the
 * callee). This distinction results in slightly different connection
 * negotiation (who is the polite peer in the perfect negotiation pattern) and
 * setup of the data channel.
 */
class PeerConnection extends Events {
    readonly localId: PeerId;
    readonly remoteId: PeerId;
    protected signalingConnection: SignalingConnection;
    protected connection: RTCPeerConnection;
    protected dataChannel: RTCDataChannel | null;
    private messageQueue: string[] = [];
    protected polite: boolean;
    private makingOffer: boolean = false;
    private ignoreOffer: boolean = false;
    private isSettingRemoteAnswerPending: boolean = false;

    constructor(remoteId: PeerId, signalingConnection: SignalingConnection) {
        super();

        this.localId = signalingConnection.peerId;
        this.remoteId = remoteId;

        // Need to specify two URIs for the TURN server (with "?transport=tcp"
        // and "?transport=udp", see RFC 5928) to gather both UDP client-server
        // and TCP client-server ICE candidates (at least if there are no SRV
        // resource records as defined in RFC 5928 for that TURN server).
        // Otherwise we get only UDP candidates per default, which makes WebRTC
        // connections impossible if the used browser is set to mode 4 of the
        // WebRTC IP handling policy (as defined in RFC 8828), which e.g.
        // corresponds to the option "Disable non-proxied UDP" in most Chromium
        // based browsers. If the browser is in that privacy mode and no proxy
        // capable of UDP traffic is available the only way to establish a
        // connection is using a TCP connection to the TURN server (so we need
        // to make sure that we are gathering those candidates).
        this.connection = new RTCPeerConnection({
            "iceServers": [
                { urls: `stun:${config.stunHost}:${config.stunPort}` },
                { urls: [`turn:${config.turnHost}:${config.turnPort}?transport=tcp`, `turn:${config.turnHost}:${config.turnPort}?transport=udp`], username: 'listentogether', credential: 'V6O3hlU2OgKne4Ua7Z6IjI8jX9jnEG4sk1jS168Q' }
            ]
        });
        this.connection.addEventListener("negotiationneeded", this.negotiationNeeded);
        this.connection.addEventListener("icecandidate", this.iceCandidate);
        this.connection.addEventListener("connectionstatechange", this.connectionStateChange);

        this.signalingConnection = signalingConnection;
        this.signalingConnection.on(`messagefrom:${this.remoteId}`, this.signalingMessage);
    }

    private negotiationNeeded = async () => {
        try {
            this.makingOffer = true;

            await this.connection.setLocalDescription();
            this.signalingConnection.sendMessage({
                type: "description",
                from: this.localId,
                to: this.remoteId,
                data: this.connection.localDescription
            });
        } catch (error) {
            logger.error("WebRTC negotiation error: ", error);
        } finally {
            this.makingOffer = false;
        }
    }

    private iceCandidate = (event: RTCPeerConnectionIceEvent) => {
        this.signalingConnection.sendMessage({
            type: "icecandidate",
            from: this.localId,
            to: this.remoteId,
            data: event.candidate
        });
    }

    private connectionStateChange = async () => {
        if (this.connection.connectionState === "connected") {
            this.emit("connected");
        }
    }

    private signalingMessage = async (message: any) => {
        try {
            if (message.type === "description") {
                const readyForOffer = !this.makingOffer && (this.connection.signalingState === "stable" || this.isSettingRemoteAnswerPending);
                const offerCollision = message.data.type === "offer" && !readyForOffer;
                this.ignoreOffer = !this.polite && offerCollision;
                if (this.ignoreOffer) {
                    return;
                }

                this.isSettingRemoteAnswerPending = message.data.type === "answer";
                await this.connection.setRemoteDescription(message.data);
                this.isSettingRemoteAnswerPending = false;

                if (message.data.type === "offer") {
                    await this.connection.setLocalDescription();
                    this.signalingConnection.sendMessage({
                        type: "description",
                        from: this.localId,
                        to: this.remoteId,
                        data: this.connection.localDescription
                    });
                }
            } else if (message.type === "icecandidate") {
                try {
                    await this.connection.addIceCandidate(message.data);
                } catch (error) {
                    if (!this.ignoreOffer) {
                        logger.error("WebRTC negotiation error: ", error);
                    }
                }
            }
        } catch (error) {
            logger.error("WebRTC negotiation error: ", error);
        }
    }

    protected dataChannelSetup() {
        this.dataChannel.addEventListener("open", () => {
            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                this.dataChannel.send(message);
                logger.log(`Send enqueued message to ${this.remoteId}: `, JSON.parse(message));
            }
            this.emit("open");
        });
        this.dataChannel.addEventListener("message", this.receiveMessage);
    }

    private receiveMessage = (event: MessageEvent) => {
        try {
            const message = JSON.parse(event.data);
            logger.log(`Received messag from ${this.remoteId}: `, message);
            this.emit("message", message);
        } catch (error) {
            logger.warn(`Received malformed message from ${this.remoteId}: `, event.data);
        }
    }

    sendMessage(message: any) {
        if (this.dataChannel.readyState === "open") {
            this.dataChannel.send(JSON.stringify(message));
            logger.log(`Send message to ${this.remoteId}: `, message);
        } else {
            this.messageQueue.push(JSON.stringify(message));
        }
    }
}

class PeerConnectionCaller extends PeerConnection {
    constructor(remoteId: PeerId, signalingConnection: SignalingConnection) {
        super(remoteId, signalingConnection);

        this.polite = false;
        this.dataChannel = this.connection.createDataChannel("data");
        this.dataChannelSetup();
    }
}

class PeerConnectionCallee extends PeerConnection {
    constructor(remoteId: PeerId, signalingConnection: SignalingConnection) {
        super(remoteId, signalingConnection);

        this.polite = true;
        this.connection.addEventListener("datachannel", (event: RTCDataChannelEvent) => {
            this.dataChannel = event.channel;
            this.dataChannelSetup();
        });
    }
}

class ListeningPeer extends Events {
    readonly id: PeerId = Math.floor(Math.random()*2**18).toString(36).padStart(4,'0');
    private signalingConnection: SignalingConnection;
    protected peerConnections: Map<PeerId, PeerConnection> = new Map<PeerId, PeerConnection>();
    protected state: SyncedListeningState;

    constructor(state: SyncedListeningState) {
        super();

        this.signalingConnection = new SignalingConnection(this.id);
        this.signalingConnection.on("message", (message: any) => {
            if (message.type === "description" && !this.peerConnections.has(message.from)) {
                const peerConnection = new PeerConnectionCallee(message.from, this.signalingConnection);
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

        const peerConnection = new PeerConnectionCaller(peerId, this.signalingConnection);
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