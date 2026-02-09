import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL;

let socket;

export const initSocket = (userId) => {
    if (socket) return socket;

    socket = io(SOCKET_URL);

    socket.on("connect", () => {
        console.log("Connected to Socket.io server");
        socket.emit("join_room", userId);
    });

    return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
