const { Server } = require('socket.io');

var io;
exports.initialSocketServer = (server) => {
    io = new Server(server, {
        path: '/socket.io',
        cors: {
            origin: '*',
        },
    });

    io.on('connection', (socket) => {
        console.log('Client connected');
        socket.on('message', (msg) => {
            io.emit('message', msg);
        });
        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });
    });

    return io;
}

// Export io instance for use in other modules
exports.getIO = () => io;

// Function to send notifications to all clients
exports.sendNotification = (message) => {
    io.emit('notification', message); // Broadcasts the notification to all connected clients
}

exports.sendUpcomingMeetingAlerts = (message) => {
    io.emit('upcoming-meeting-alert', message);
}