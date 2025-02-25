import { io } from 'socket.io-client';
import { create } from 'zustand';

const useSocketStore = create((set) => ({
  socket: null,
  connected: false,
  authError: null,
  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ connected }),
  setAuthError: (error) => set({ authError: error }),
}));

export const initializeSocket = () => {
  // Clean up any existing socket connection
  if (useSocketStore.getState().socket) {
    useSocketStore.getState().socket.disconnect();
  }
  
  // Get session token from localStorage
  const sessionToken = localStorage.getItem('session_token');
  
  if (!sessionToken) {
    console.error('No session token available for socket initialization');
    useSocketStore.getState().setAuthError('No session token available');
    return null;
  }
  
  console.log('Initializing socket connection...');
  
  // Check if we have an access key in localStorage (from URL exchange)
  const accessKey = localStorage.getItem('access_key');
  
  const socket = io('/', {
    auth: accessKey ? { access_key: accessKey } : { token: sessionToken },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 5000
  });
  
  // Remove the access key after use
  if (accessKey) {
    localStorage.removeItem('access_key');
  }

  socket.on('connect', () => {
    console.log('Socket connected');
    useSocketStore.getState().setConnected(true);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
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
