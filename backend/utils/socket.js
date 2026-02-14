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
        connectTimeout: 45000,
        allowEIO3: true // Support older clients if needed
    });

    io.on("connection", (socket) => {
        // Socket error handler
        socket.on("error", (err) => {
            console.error(`Socket error for ${socket.id}:`, err);
        });

        socket.on("join_room", (userId) => {
            try {
                if (!userId) return;
                socket.join(`user_${userId}`);
            } catch (err) {
                console.error(`Error joining room user_${userId}:`, err);
            }
        });

        socket.on("send_message", (data) => {
            try {
                // Data: { senderId, receiverId, message, createdAt }
                const { receiverId } = data;
                if (!receiverId) return;

                io.to(`user_${receiverId}`).emit("receive_message", data);

                // Also notify the receiver about a new notification
                io.to(`user_${receiverId}`).emit("new_notification", {
                    type: "MESSAGE",
                    title: "New Message",
                    message: data.message,
                    senderId: data.senderId
                });
            } catch (err) {
                console.error("Error sending message via socket:", err);
            }
        });

        socket.on("disconnect", (reason) => {
            // connection lost, etc.
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
