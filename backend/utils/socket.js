const { Server } = require("socket.io");

let io;

const initSocket = (server) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ["*"];

    io = new Server(server, {
        cors: {
            origin: process.env.NODE_ENV === 'production' ? allowedOrigins : "*",
            methods: ["GET", "POST"]
        },
        // Production stability settings
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    io.on("connection", (socket) => {
        console.log(`User connected: ${socket.id}`);

        socket.on("join_room", (userId) => {
            socket.join(`user_${userId}`);
            console.log(`User ${userId} joined room user_${userId}`);
        });

        socket.on("send_message", (data) => {
            // Data: { senderId, receiverId, message, createdAt }
            const { receiverId } = data;
            io.to(`user_${receiverId}`).emit("receive_message", data);

            // Also notify the receiver about a new notification if needed
            io.to(`user_${receiverId}`).emit("new_notification", {
                type: "MESSAGE",
                title: "New Message",
                message: data.message,
                senderId: data.senderId
            });
        });

        socket.on("disconnect", () => {
            console.log("User disconnected", socket.id);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

module.exports = { initSocket, getIO };
