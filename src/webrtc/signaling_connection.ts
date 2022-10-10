import { Events } from "../util/events";
import { logger } from "../util/logger";
import { PeerId } from "./peer_connection";

export type SignalingMessage = {
    type: "description" | "icecandidate",
    from?: PeerId,
    to: PeerId,
    data: any
}

export type SignalingConnectionOptions = {
    peerId: PeerId,
    host: string,
    port: number
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
 * Upon connection the {@link SignalingConnection#peerId} is claimed and the
 * server associates this connection as the only valid connection to send
 * messages on behalf of that peer (and only of that peer), so one connection
 * per peer is needed.
 */
 export class SignalingConnection extends Events {
    readonly peerId: PeerId;
    private signalingSocket: WebSocket;
    private messageQueue: string[] = [];

    constructor(options: SignalingConnectionOptions) {
        super();

        this.peerId = options.peerId;
        this.signalingSocket = new WebSocket(`wss://${options.host}:${options.port}?version=1&id=${this.peerId}`),
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