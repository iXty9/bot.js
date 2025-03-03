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
  
  // Get authentication credentials from localStorage
  const discordToken = token || localStorage.getItem('discord_token');
  const sessionToken = localStorage.getItem('session_token');
  const apiKey = localStorage.getItem('api_key');
  
  if (!discordToken && !sessionToken && !apiKey) {
    console.error('No authentication credentials available for socket initialization');
    useSocketStore.getState().setAuthError('No authentication credentials available');
    return null;
  }
  
  // Don't log any sensitive information
  console.log('Initializing socket connection (auth available)');
  
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
    console.log('Using session token for auth');
  }
  
  if (discordToken) {
    // Use Discord token as a fallback
    auth.discord_token = discordToken;
    // Also set as token for compatibility with server authentication
    auth.token = discordToken;
    console.log('Using Discord token for auth');
  }
  
  // For development, add a bypass flag
  auth.dev_mode = 'true';
  console.log('Added dev mode flag for socket auth');
  
  // Get the server URL from the current window location
  const url = window.location.origin;
  
  console.log(`Connecting to Socket.IO server at ${url}`);
  
  const socket = io(url, {
    auth,
    transports: ['polling', 'websocket'], // Start with polling first, then upgrade
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 30000, // Increase timeout to 30 seconds
    path: '/socket.io/',
    forceNew: true,
    autoConnect: true
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
    
    // Always try to reconnect with polling first
    console.log('Reconnecting with polling transport...');
    socket.io.opts.transports = ['polling', 'websocket'];
    
    // Force reconnect after a short delay
    setTimeout(() => {
      if (!socket.connected) {
        console.log('Attempting to reconnect socket...');
        socket.connect();
      }
    }, 2000);
  });
  
  // Add ping/pong for connection health check
  socket.on('ping', (data) => {
    try {
      socket.emit('pong', { timestamp: Date.now(), received: data });
    } catch (err) {
      console.error('Error in ping/pong:', err);
    }
  });
  
  // Handle transport errors
  socket.io.engine.on('error', (err) => {
    console.error('Transport error:', err);
  });
  
  // Handle upgrade success
  socket.io.engine.on('upgrade', () => {
    console.log('Socket transport upgraded successfully');
  });

  useSocketStore.getState().setSocket(socket);
  return socket;
};

export const useSocket = () => useSocketStore();
