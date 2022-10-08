const ws = require("ws");

const server = new ws.Server({ port: 5000 });
const peers = new Map();

const CLOSE_CODES = {
    ID_TAKEN: 4000,
    MISSING_ID: 4001,
    INVALID_ID: 4002
}

const onMessage = (id, data) => {
    if (typeof(data) !== "string") {
        return;
    }

    const message = JSON.parse(data);
    if (message.to !== null && peers.has(message.to)) {
        const receiver = peers.get(message.to);
        receiver.send(data);
    }
}

const onClose = (id) => {
    peers.delete(id);
}

server.on("connection", (socket, request) => {
    const index = request.url.indexOf("?");
    const searchParams = index !== -1 ? new URLSearchParams(request.url.substring(index)) : null;
    const id = searchParams?.get("id");

    if (id === null) {
        socket.close(CLOSE_CODES.ID_TAKEN);
    } else if (peers.has(id)) {
        socket.close(CLOSE_CODES.MISSING_ID);
    } else {
        peers.set(id, socket);
        socket.on("message", (data) => onMessage(id, data));
        socket.on("close", () => onClose(id));


        socket.on("message", (data) => {
            console.log(data, typeof(data), JSON.parse(data));
            console.log(`<-m New message from peer ${id}`);
        });
    }
});