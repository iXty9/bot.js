import { io } from 'socket.io-client';
import { useState, useEffect } from 'react';

let socket = null;
let socketInitialized = false;

export const initializeSocket = (token) => {
  if (socketInitialized) {
    console.log('Socket already initialized, disconnecting old socket');
    if (socket) socket.disconnect();
  }
  
  if (!token) {
    console.error('No token provided for socket initialization');
    return null;
  }
  
  try {
    console.log('Initializing socket connection with auth token');
    
    // Get the server URL from the current window location
    const url = window.location.origin;
    
    console.log(`Connecting to Socket.IO server at ${url}`);
    
    socket = io(url, {
      auth: { token },
      transports: ['polling', 'websocket'], // Start with polling first, then upgrade
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      forceNew: true,
      autoConnect: true
    });
    
    socket.on('connect', () => {
      console.log('Socket connected successfully');
    });
    
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    socketInitialized = true;
    return socket;
  } catch (error) {
    console.error('Error initializing socket:', error);
    return null;
  }
};

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  
  useEffect(() => {
    if (!socket) return;
    
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onMessage = (message) => setLastMessage(message);
    
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message', onMessage);
    
    // Check initial connection state
    setIsConnected(socket.connected);
    
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message', onMessage);
    };
  }, []);
  
  return {
    socket,
    isConnected,
    lastMessage
  };
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketInitialized = false;
    console.log('Socket disconnected and reference cleared');
  }
};
