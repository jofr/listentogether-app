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
    private signalingUrl: string;
    private signalingSocket: WebSocket;
    private startedReconnectingAtLeastOnce: boolean = false;
    private messageQueue: string[] = [];

    constructor(options: SignalingConnectionOptions) {
        super();

        this.peerId = options.peerId;
        this.signalingUrl = `wss://${options.host}:${options.port}/signaling?version=1&id=${this.peerId}`;
        this.connectToSignalingServer();
    }

    private connectToSignalingServer() {
        this.signalingSocket = new WebSocket(this.signalingUrl),
        this.signalingSocket.addEventListener("open", () => {
            logger.debug(`Signaling connection for peer ${this.peerId} open`);
            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                this.signalingSocket.send(message);
                logger.debug(`Sending enqueued signaling message (from ${this.peerId}): `, JSON.parse(message));
            }
        });
        this.signalingSocket.addEventListener("message", this.receiveMessage);
        this.signalingSocket.addEventListener("close", (event: CloseEvent) => {
            const normalClosure = (event.code === 1000);
            // Codes 4000-4002 mean that id is either taken, missing or invalid
            const idError = [4000, 4001, 4002].includes(event.code);
            const idTakenError = (event.code === 4000);
            // Codes for "Abnormal closure" (happens e.g. if switching from wifi
            // to mobile connection), "Service restart" or "Try again later",
            // all cases where trying to reconnect might be successful
            const networkError = [1006, 1012, 1013].includes(event.code);

            // Error for taken id is only meaningful on first connect (if trying
            // to reconnect the id already was successfully ours but it might
            // take a while for the id to be available again if the signaling
            // server has yet to realize that the old signaling connection is no
            // more)
            if ((idError && !idTakenError) || (idTakenError && !this.startedReconnectingAtLeastOnce)) {
                logger.error(`Signaling connection for peer ${this.peerId} closed because peer id is either taken, missing or invalid (code ${event.code})`);
            } else if (networkError || (idTakenError && this.startedReconnectingAtLeastOnce)) {
                logger.warn(`Signaling connection for peer ${this.peerId} closed (code ${event.code}), trying to reconnect in 15 seconds`);
                this.startedReconnectingAtLeastOnce = true;
                setTimeout(() => {
                    this.connectToSignalingServer();
                }, 15000);
            } else if (normalClosure) {
                logger.debug(`Signaling connection for peer ${this.peerId} closed`);
            } else {
                logger.error(`Signaling connection for peer ${this.peerId} closed (code ${event.code}): `, event.reason);
            }
        });
        this.signalingSocket.addEventListener("error", (event: Event) => {
            logger.error(`Signaling connection error (for peer ${this.peerId}): `, event);
        });
    }

    private receiveMessage = (event: MessageEvent) => {
        try {
            const message = JSON.parse(event.data);
            const fromId = message.from;
            if (fromId === undefined) throw new Error("Field 'from' missing in signaling message");
            logger.debug(`Received signaling message (for peer ${this.peerId}): `, message);
            this.emit("message", message);
            this.emit(`messagefrom:${fromId}`, message);
        } catch (error) {
            logger.warn(`Received malformed signaling message (for peer ${this.peerId}): `, event.data);
        }
    }

    sendMessage(message: SignalingMessage) {
        if (this.signalingSocket.readyState === WebSocket.OPEN) {
            this.signalingSocket.send(JSON.stringify(message));
            logger.debug(`Send signaling message (for peer ${this.peerId}): `, message);
        } else {
            this.messageQueue.push(JSON.stringify(message));
            logger.log(`Queued signaling message (for peer ${this.peerId}): `, message);
        }
    }

    close() {
        // Set code to 1000 (normal closure) to not trigger reconnect
        this.signalingSocket.close(1000);
    }
}