import { io } from 'socket.io-client';
import { create } from 'zustand';

const useSocketStore = create((set) => ({
  socket: null,
  connected: false,
  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ connected }),
}));

export const initializeSocket = (token) => {
  // Clean up any existing socket connection
  if (useSocketStore.getState().socket) {
    useSocketStore.getState().socket.disconnect();
  }
  
  const socket = io('/', {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    useSocketStore.getState().setConnected(true);
  });

  socket.on('disconnect', (reason) => {
    useSocketStore.getState().setConnected(false);
    
    if (reason === 'io server disconnect') {
      // Disconnected by server, attempt reconnection
      setTimeout(() => {
        socket.connect();
      }, 1000);
    }
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    useSocketStore.getState().setConnected(false);
  });

  useSocketStore.getState().setSocket(socket);
  return socket;
};

export const useSocket = () => useSocketStore();
