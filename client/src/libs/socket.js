import { io } from 'socket.io-client';

var socket = io(process.env.REACT_SOCKET_URL);



const getSocket = () => {
    socket.on('connect', () => {
        console.log('Connected to Socket.IO server');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    return socket;
}


export default getSocket; 