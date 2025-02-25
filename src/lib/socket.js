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

export const initializeSocket = (token) => {
  // Clean up any existing socket connection
  if (useSocketStore.getState().socket) {
    useSocketStore.getState().socket.disconnect();
  }
  
  if (!token) {
    console.error('No token provided for socket initialization');
    useSocketStore.getState().setAuthError('No authentication token provided');
    return null;
  }
  
  // Get token from localStorage if not provided
  // Use the original token exactly as it was received
  let authToken = token || localStorage.getItem('discord_bot_token_original');
  
  // Fall back to regular token if original is not available
  if (!authToken) {
    authToken = localStorage.getItem('discord_bot_token');
  }
  if (!authToken) {
    console.error('No token available for socket initialization');
    useSocketStore.getState().setAuthError('No authentication token available');
    return null;
  }
  
  console.log('Initializing socket connection...');
  console.log(`Socket token length: ${authToken.length}, first 5 chars: ${authToken.substring(0, 5)}, last 5 chars: ${authToken.slice(-5)}`);
  
  // Check if we have an access key in localStorage (from URL exchange)
  const accessKey = localStorage.getItem('access_key');
  
  const socket = io('/', {
    auth: accessKey ? { access_key: accessKey } : { token: authToken },
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
