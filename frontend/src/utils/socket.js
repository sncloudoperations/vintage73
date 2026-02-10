import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL;

let socket;

export const initSocket = (userId) => {
    if (socket) return socket;

    socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
    });

    socket.on("connect", () => {
        console.log("[SOCKET] Connected to server");
        socket.emit("join_room", userId);
    });

    socket.on("connect_error", (err) => {
        console.error("[SOCKET] Connection Error:", err.message);
    });

    socket.on("reconnect_attempt", () => {
        console.log("[SOCKET] Attempting to reconnect...");
    });

    socket.on("disconnect", (reason) => {
        console.warn("[SOCKET] Disconnected:", reason);
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
