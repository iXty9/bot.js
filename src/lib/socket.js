import { io } from 'socket.io-client';
import { useState, useEffect } from 'react';

// Only log to console if DEBUG=true
function debugLog(message) {
  if (process.env.DEBUG === 'true') {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

// Logging utility to write to log file only
function logToFile(message) {
  // Only works in Node.js, not browser
  if (typeof window === 'undefined') {
    const fs = require('fs');
    const path = require('path');
    const logFilePath = path.resolve(process.cwd(), 'console.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFilePath, `${timestamp} - [Socket] ${message}\n`);
  }
}

let socket = null;
let socketInitialized = false;

export const initializeSocket = (token) => {
  if (socketInitialized) {
    logToFile('Socket already initialized, disconnecting old socket');
    debugLog('Socket already initialized, disconnecting old socket');
    if (socket) socket.disconnect();
  }

  if (!token) {
    logToFile('No token provided for socket initialization');
    debugLog('No token provided for socket initialization');
    return null;
  }

  try {
    logToFile('Initializing socket connection with auth token');
    debugLog('Initializing socket connection with auth token');

    // Get the server URL from the current window location
    const url = window.location.origin;

    logToFile(`Connecting to Socket.IO server at ${url}`);
    debugLog(`Connecting to Socket.IO server at ${url}`);

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
      logToFile('Socket connected successfully');
      debugLog('Socket connected successfully');
    });

    socket.on('disconnect', (reason) => {
      logToFile(`Socket disconnected: ${reason}`);
      debugLog(`Socket disconnected: ${reason}`);
    });

    socket.on('connect_error', (error) => {
      logToFile(`Socket connection error: ${error.message}`);
      debugLog(`Socket connection error: ${error.message}`);
    });

    socketInitialized = true;
    return socket;
  } catch (error) {
    logToFile(`Error initializing socket: ${error.message}`);
    debugLog(`Error initializing socket: ${error.message}`);
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
    logToFile('Socket disconnected and reference cleared');
    debugLog('Socket disconnected and reference cleared');
  }
};
