import { Events } from "../util/events";
import { logger } from "../util/logger";
import { SignalingConnection, SignalingMessage } from "./signaling_connection";

export type PeerId = string;

export type PeerConnectionOptions = {
    signalingConnection: SignalingConnection,
    remoteId: PeerId,
    stunHost: string,
    stunPort: number,
    turnHost: string,
    turnPort: number,
    turnUsername?: string,
    turnPassword?: string,
    turnCredentialsRestApiUrl?: string
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
 * instead {@link CallerPeerConnection} or {@link CalleePeerConnection} should
 * be used depending on wether the peer is initiating the connection (so is the
 * caller) or the peer is aware of a connection attempt to itself (so is the
 * callee). This distinction results in slightly different connection
 * negotiation (who is the polite peer in the perfect negotiation pattern) and
 * setup of the data channel.
 */
 export class PeerConnection extends Events {
    readonly localId: PeerId;
    readonly remoteId: PeerId;
    protected signalingConnection: SignalingConnection;
    private signalingMessageBuffer: SignalingMessage[] = [];
    protected connection: RTCPeerConnection | null = null;
    private hasBeenConnected: boolean = false;
    protected dataChannel: RTCDataChannel | null;
    private messageQueue: string[] = [];
    protected polite: boolean;
    private makingOffer: boolean = false;
    private ignoreOffer: boolean = false;
    private isSettingRemoteAnswerPending: boolean = false;

    constructor(options: PeerConnectionOptions) {
        super();

        this.localId = options.signalingConnection.peerId;
        this.remoteId = options.remoteId;

        if (options.turnCredentialsRestApiUrl) {
            fetch(options.turnCredentialsRestApiUrl).then(response => response.json()).then((credentials) => {
                options.turnUsername = credentials.username;
                options.turnPassword = credentials.password;

                this.peerConnectionSetup(options);

                while (this.signalingMessageBuffer.length > 0) {
                    const message = this.signalingMessageBuffer.shift();
                    this.signalingMessage(message);
                }

                setInterval(() => {
                    fetch(options.turnCredentialsRestApiUrl).then(response => response.json()).then((credentials) => {
                        options.turnUsername = credentials.username;
                        options.turnPassword = credentials.password;
                        
                        this.connection.setConfiguration(this.getConfiguration(options));
                    });
                }, (credentials.ttl - 120) * 1000);
            });
        } else {
            this.peerConnectionSetup(options);
        }
        
        this.signalingConnection = options.signalingConnection;
        this.signalingConnection.on(`messagefrom:${this.remoteId}`, this.signalingMessage);
    }

    protected getConfiguration(options: PeerConnectionOptions) {
        return {
            "iceServers": [
                {
                    urls: `stun:${options.stunHost}:${options.stunPort}`
                },
                {
                    // Need to specify two URIs for the TURN server (with
                    // "?transport=tcp" and "?transport=udp", see RFC 5928) to
                    // gather both UDP client-server and TCP client-server ICE
                    // candidates (at least if there are no SRV resource records
                    // as defined in RFC 5928 for that TURN server). Otherwise
                    // we get only UDP candidates per default, which makes
                    // WebRTC connections impossible if the used browser is set
                    // to mode 4 of the WebRTC IP handling policy (as defined in
                    // RFC 8828), which e.g. corresponds to the option "Disable
                    // non-proxied UDP" in most Chromium based browsers. If the
                    // browser is in that privacy mode and no proxy capable of
                    // UDP traffic is available the only way to establish a
                    // connection is using a TCP connection to the TURN server
                    // (so we need to make sure that we are gathering those
                    // candidates).
                    urls: [
                        `turn:${options.turnHost}:${options.turnPort}?transport=tcp`,
                        `turn:${options.turnHost}:${options.turnPort}?transport=udp`,
                        `turns:${options.turnHost}:${options.turnPort}`
                    ],
                    username: options.turnUsername,
                    credential: options.turnPassword
                }
            ]
        }
    }

    protected peerConnectionSetup(options: PeerConnectionOptions) {
        this.connection = new RTCPeerConnection(this.getConfiguration(options));

        this.connection.addEventListener("negotiationneeded", this.negotiationNeeded);
        this.connection.addEventListener("icecandidate", this.iceCandidate);
        this.connection.addEventListener("connectionstatechange", this.connectionStateChange);
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
            logger.error(`WebRTC negotiation error (for connection ${this.localId}<->${this.remoteId}): `, error);
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
            if (!this.hasBeenConnected) {
                this.hasBeenConnected = true;
                logger.debug(`Peer connection (${this.localId}<->${this.remoteId}) connected`);
                this.emit("connected");
            } else {
                logger.debug(`Peer connection (${this.localId}<->${this.remoteId}) reconnected`);
                this.emit("reconnected");
            }
        } else if (this.connection.connectionState === "disconnected") {
            // TODO: This is either a temporary connection problem (that solves
            // itself) or the state will eventually transition to "failed". But
            // it might be useful to make this state available anyways (e.g. for
            // user interface indications of potential connectivity problems)?
        } else if (this.connection.connectionState === "failed") {
            // TODO: Most of the time this will be caused by network changes
            // (temporarily no connection on mobile, switch from wifi to mobile,
            // etc.) so there's a good chance the signaling connection is also
            // down. Restarting directly works anyways because the signaling
            // connection buffers the messages and eventually delivers them but
            // if the network changed the candidates might be outdated already,
            // so maybe it is useful to check the signaling connection here and
            // postpone the ICE restart until the signaling connection is back
            // again?
            logger.debug(`Peer connection (${this.localId}<->${this.remoteId}) failed, restarting ICE`);
            this.connection.restartIce();
            // TODO: If restarting ICE is not successful after some time the
            // peer connection should be closed
        } else if (this.connection.connectionState === "closed") {
            logger.debug(`Peer connection (${this.localId}<->${this.remoteId}) closed`);
            this.emit("closed");
        }
    }

    private signalingMessage = async (message: any) => {
        if (!this.connection) {
            this.signalingMessageBuffer.push(message);
            return;
        }

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
                        logger.error(`WebRTC negotiation error (for connection ${this.localId}<->${this.remoteId}): `, error);
                    }
                }
            }
        } catch (error) {
            logger.error(`WebRTC negotiation error (for connection ${this.localId}<->${this.remoteId}): `, error);
        }
    }

    protected dataChannelSetup() {
        // TODO: data channel actually supports queueing, so we only need to
        // queue for time before the datachannel event and can then empty the
        // queue (even if data channel is not yet open)
        this.dataChannel.addEventListener("open", () => {
            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                this.dataChannel.send(message);
                logger.debug(`Sending enqueued message on data channel (${this.localId}<->${this.remoteId}): `, JSON.parse(message));
            }
            this.emit("datachannelopen");
        });
        this.dataChannel.addEventListener("message", this.receiveMessage);
    }

    private receiveMessage = (event: MessageEvent) => {
        try {
            const message = JSON.parse(event.data);
            logger.debug(`Received messag on data channel (${this.localId}<->${this.remoteId}): `, message);
            this.emit("message", message);
        } catch (error) {
            logger.warn(`Received malformed message on data channel (${this.localId}<->${this.remoteId}): `, event.data);
        }
    }

    sendMessage(message: any) {
        if (this.dataChannel && this.dataChannel.readyState === "open") {
            this.dataChannel.send(JSON.stringify(message));
            logger.debug(`Sending message on data channel (${this.localId}<->${this.remoteId}): `, message);
        } else {
            this.messageQueue.push(JSON.stringify(message));
            logger.debug(`Queued message for data channel (${this.localId}<->${this.remoteId}): `, message);
        }
    }

    close() {
        this.connection?.close();
    }
}

export class CallerPeerConnection extends PeerConnection {
    constructor(options: PeerConnectionOptions) {
        super(options);

        this.polite = false;
    }

    protected peerConnectionSetup(options: PeerConnectionOptions): void {
        super.peerConnectionSetup(options);

        this.dataChannel = this.connection.createDataChannel("data");
        this.dataChannelSetup();
    }
}

export class CalleePeerConnection extends PeerConnection {
    constructor(options: PeerConnectionOptions) {
        super(options);

        this.polite = true;
    }

    protected peerConnectionSetup(options: PeerConnectionOptions): void {
        super.peerConnectionSetup(options);

        this.connection.addEventListener("datachannel", (event: RTCDataChannelEvent) => {
            this.dataChannel = event.channel;
            this.dataChannelSetup();
        });
    }
}