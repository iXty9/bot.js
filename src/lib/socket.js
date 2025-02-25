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
  // Try to use the original token first (not normalized)
  let authToken = token ? token.trim() : localStorage.getItem('discord_bot_token_original');
  
  // Fall back to normalized token if original is not available
  if (!authToken) {
    authToken = localStorage.getItem('discord_bot_token');
  }
  if (!authToken) {
    console.error('No token available for socket initialization');
    useSocketStore.getState().setAuthError('No authentication token available');
    return null;
  }
  
  // Clean the token thoroughly and normalize case
  // Ensure consistent lowercase format for comparison
  authToken = authToken.trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, '').toLowerCase();
  
  console.log('Initializing socket connection...');
  console.log(`Socket token length: ${authToken.length}, first 5 chars: ${authToken.substring(0, 5)}, last 5 chars: ${authToken.slice(-5)}`);
  const socket = io('/', {
    auth: { token: authToken },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 5000
  });

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
