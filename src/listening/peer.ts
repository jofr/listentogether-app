import Peer, { DataConnection } from "peerjs";

import { Events } from "../util/events";
import { ListenerId, ListeningState } from "./state";
import { SyncedListeningState, SyncMessage } from "./sync";
import { logger } from "../util/logger";

import config from "../../config.json";

export enum ConnectionState {
    CONNECTING, CONNECTED, CLOSED, ERROR
}

class ListeningPeer extends Events {
    protected peer: Peer;

    constructor(protected state: SyncedListeningState) {
        super();

        const id: string = Math.floor(Math.random()*2**18).toString(36).padStart(4,'0');
        this.peer = new Peer(id, {
            host: config.peerServer,
            path: "/",
            port: config.signalingPort,
            secure: true,
            debug: 0,
            config: {'iceServers': [
                { url: `stun:${config.peerServer}:${config.stunPort}` },
                { url: `turn:${config.peerServer}:${config.turnPort}`, username: 'listentogether', credential: 'V6O3hlU2OgKne4Ua7Z6IjI8jX9jnEG4sk1jS168Q' }
            ]}
        });
        this.peer.on("open", () => this.peerSetup());
        this.peer.on("disconnected", () => this.peerDisconnected());
        this.peer.on("error", (error: any) => this.peerError(error));
    }

    protected peerSetup(): void {
        logger.log("Peer established connection to signalling server");
    }

    protected peerDisconnected(): void {
        logger.log("Peer lost connection to signalling server, trying to reconnect");

        this.peer.reconnect(); /* TODO: Does this call peerSetup() again? (through the open event) */
    }

    protected peerError(error: any): void {
        logger.error("Error in peer: ", error);
    }

    protected createInvitationUrl(id: string) {
        if (window.location.host.includes("localhost")) {
            return `https://listentogether.gitlab.io/app/#${id}`;
        } else {
            return `${window.location.origin}${window.location.pathname}#${id}`;
        }
    }

    get id(): string {
        return this.peer.id;
    }
}

export class ListeningHost extends ListeningPeer {
    private listenerConnections: Set<DataConnection> = new Set<DataConnection>();

    protected peerSetup(): void {
        /* Setup is only necessary once, but peerSetup gets called again in case of a dis- and reconnect */
        if (this.state.listeners.includes(this.peer.id)) {
            return;
        }

        this.state.applyChange((state: ListeningState) => {
            state.listeners.push(this.peer.id);
        });

        this.peer.on("connection", this.listenerConnected);

        this.state.subscribe(["listeners"], () => this.sendSyncToListeners("listeners"));
        this.state.subscribe(["playlist"], () => this.sendSyncToListeners("playlist"));
        this.state.subscribe(["playback"], () => this.sendSyncToListeners("playback"));
    }

    private listenerConnected = (connection: DataConnection) => {
        this.listenerConnections.add(connection);
        connection.on("open", () => this.connectionOpen(connection));
        connection.on("close", () => this.connectionClosed(connection));
        connection.on("error", (error: any) => this.connectionError(connection, error));
    }

    private connectionOpen = (connection: DataConnection): void => {
        logger.log(`Connection to listener ${connection.peer} open`);

        this.state.applyChange((state: ListeningState) => {
            state.listeners.push(connection.peer);
        });

        this.sendSyncToListeners("playlist", [connection.peer]);
        this.sendSyncToListeners("playback", [connection.peer]);
    }

    private deleteConnection(connection: DataConnection) {
        this.state.applyChange((state: ListeningState) => {
            const index = state.listeners.indexOf(connection.peer);
            state.listeners.splice(index, 1);
        });

        this.listenerConnections.delete(connection);
    }

    private connectionClosed = (connection: DataConnection): void => {
        this.deleteConnection(connection);

        logger.log(`Connection to listener ${connection.peer} closed`);
    }

    private connectionError = (connection: DataConnection, error: any): void => {
        this.deleteConnection(connection);

        logger.log(`Error in connection to listener ${connection.peer}:`, error);
    }

    private sendSyncToListeners = (type: string, listeners?: ListenerId[]) => {
        const listenerConnections = listeners === undefined
                                  ? this.listenerConnections
                                  : Array.from(this.listenerConnections).filter((connection: DataConnection) => listeners.includes(connection.peer));
        for (const connection of listenerConnections) {
            if (connection.open) {
                connection.send({
                    type: type,
                    data: this.state[type]
                });
            } else {
                logger.warn(`Tried sending sync but connection to listener ${connection.peer} not open`);
            }
        }
    }

    get invitationUrl(): string {
        return this.createInvitationUrl(this.peer.id);
    }
}

export class ListeningListener extends ListeningPeer {
    private hostConnection: DataConnection;
    connectionState: ConnectionState = ConnectionState.CONNECTING;

    constructor (readonly hostId: string, state: SyncedListeningState) {
        super(state);
    }

    protected peerSetup(): void {
        this.hostConnection = this.peer.connect(this.hostId, { reliable: true });
        this.hostConnection.on("open", this.connectionOpen);
        this.hostConnection.on("close", this.connectionClosed);
        this.hostConnection.on("error", this.connectionError);
        this.hostConnection.on("data", this.applySyncMessage);
    }

    private connectionOpen = (): void => {
        logger.log(`Connection to host ${this.hostId} open:`, this.hostConnection);

        this.connectionState = ConnectionState.CONNECTED;
        this.emit("connectionchange");
    }

    private connectionClosed = (): void => {
        logger.log(`Connection to host ${this.hostId} closed`);

        this.connectionState = ConnectionState.CLOSED;
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
        }
    }

    get invitationUrl(): string {
        return this.createInvitationUrl(this.hostId);
    }
}