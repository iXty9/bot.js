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
  
  // Get authentication credentials from localStorage
  const sessionToken = localStorage.getItem('session_token');
  const apiKey = localStorage.getItem('api_key');
  
  if (!sessionToken && !apiKey) {
    console.error('No authentication credentials available for socket initialization');
    useSocketStore.getState().setAuthError('No authentication credentials available');
    return null;
  }
  
  console.log('Initializing socket connection... (auth credentials available)');
  
  // Check if we have an access key in localStorage (from URL exchange)
  const accessKey = localStorage.getItem('access_key');
  
  // Prepare auth object with available credentials
  const auth = {};
  if (accessKey) {
    auth.access_key = accessKey;
    console.log('Using access key for socket auth');
  } 
  
  if (apiKey) {
    auth.api_key = apiKey;
    console.log('Using API key for socket auth');
  } 
  
  if (sessionToken) {
    // Send token directly without Bearer prefix
    auth.token = sessionToken;
    // Don't log sensitive token information
    console.log('Using session token for socket auth');
  }
  
  // For development, add a bypass flag
  auth.dev_mode = 'true';
  console.log('Added dev mode flag for socket auth');
  
  // Get the server URL from the current window location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const url = `${window.location.protocol}//${host}`;
  
  console.log(`Connecting to Socket.IO server at ${url}`);
  
  const socket = io(url, {
    auth,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
    path: '/socket.io/'
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
    
    // Set auth error if it's an authentication issue
    if (error.message.includes('Authentication') || error.message.includes('auth')) {
      useSocketStore.getState().setAuthError(error.message);
    }
    
    // Try to reconnect with polling if websocket fails
    if (socket.io.opts.transports[0] === 'websocket') {
      console.log('Falling back to polling transport');
      socket.io.opts.transports = ['polling', 'websocket'];
      setTimeout(() => socket.connect(), 1000);
    }
  });
  
  // Add ping/pong for connection health check
  socket.on('ping', () => {
    socket.emit('pong');
  });

  useSocketStore.getState().setSocket(socket);
  return socket;
};

export const useSocket = () => useSocketStore();
