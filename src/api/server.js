import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Validate required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'API_PORT', 'API_HOST'];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName] || process.env[varName].trim() === '') {
    console.error(`Error: ${varName} is required in .env file`);
    process.exit(1);
  }
});

if (process.env.DISCORD_TOKEN === 'your-discord-bot-token-here') {
  console.error('Error: Please configure a valid DISCORD_TOKEN in .env file');
  // Instead of exiting, set a flag to indicate the token needs to be updated
  process.env.DISCORD_TOKEN = '';
}

import { Server } from 'socket.io';
import http from 'http';
import BotManager from '../BotManager.js';
const app = express();
const PORT = process.env.API_PORT || 6987;
const HOST = process.env.API_HOST || '0.0.0.0';
app.set('trust proxy', true);

app.use(cors());
app.use(bodyParser.json());

// Import simple authentication utilities
import { validateApiKey, validateSession } from '../lib/simpleAuth.js';

// Authentication middleware
function authenticateToken(req, res, next) {
  try {
    // 1. Check for API key in header (preferred method)
    const apiKey = req.headers['x-api-key'];
    if (apiKey && validateApiKey(apiKey)) {
      console.log('API key authentication successful');
      req.user = { authorized: true };
      next();
      return;
    }
    
    // 2. Check for access key in query parameters (for initial auth only)
    const accessKey = req.query.access_key;
    if (accessKey && (accessKey === global.WEB_UI_ACCESS_KEY || validateApiKey(accessKey))) {
      console.log('Access key authentication successful');
      req.user = { authorized: true };
      next();
      return;
    }
    
    // 3. Check for session token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token && validateSession(token)) {
      console.log('Session token authentication successful');
      req.user = { authorized: true };
      next();
      return;
    }
    
    // 4. Development mode bypass (only in non-production)
    if (process.env.NODE_ENV !== 'production' && 
        (token === 'dev-mode-token' || req.headers['x-dev-mode'] === 'true')) {
      console.log('Development mode authentication successful');
      req.user = { authorized: true, devMode: true };
      next();
      return;
    }
    
    // Authentication failed
    return res.status(401).json({ error: 'Authentication required' });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// Initialize BotManager with the Discord client
let botManager = null;

function initializeBotManager(client) {
  return new Promise((resolve, reject) => {
    try {
      if (!client || !client.isReady()) {
        reject(new Error('Discord client is not ready'));
        return;
      }
      
      botManager = new BotManager(client, process.env.WEBHOOK_URL);
      resolve(botManager);
      
    } catch (error) {
      reject(error);
    }
  });
}

// Export for use in index.js
export { 
  initializeBotManager,
  app
};

export const getBotManager = () => botManager;

// Health check endpoint (no auth required)
app.get('/api/health', (req, res) => {
  const authHeader = req.headers['authorization'];
  const hasAuthHeader = !!authHeader;
  
  res.json({ 
    status: 'ok',
    message: 'API server is running',
    timestamp: new Date().toISOString(),
    auth: !!process.env.DISCORD_TOKEN,
    authHeaderPresent: hasAuthHeader,
    botInitialized: !!botManager,
    botReady: botManager ? botManager.client.isReady() : false,
    nodeVersion: process.version,
    uptime: process.uptime()
  });
});

// Debug endpoint for token format (no auth required)
app.post('/api/debug/token', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    // Don't log the actual token
    const tokenInfo = {
      length: token.length,
      hasWhitespace: /\s/.test(token),
      startsWithBot: token.startsWith('Bot '),
      startsWithBearer: token.startsWith('Bearer '),
      format: token.includes('.') ? 'Appears to be JWT format' : 'Not in JWT format'
    };
    
    // Compare with environment token (safely)
    if (process.env.DISCORD_TOKEN) {
      const envToken = process.env.DISCORD_TOKEN.trim();
      
      // Clean both tokens for comparison
      const cleanToken = token.trim().replace(/\s+/g, '').toLowerCase();
      const cleanEnvToken = envToken.trim().replace(/\s+/g, '').toLowerCase();
      
      tokenInfo.matchesEnvToken = cleanToken === cleanEnvToken;
      tokenInfo.lengthDifference = token.length - envToken.length;
      tokenInfo.cleanLengthDifference = cleanToken.length - cleanEnvToken.length;
      
      // Character code analysis for first 5 and last 5 chars
      tokenInfo.firstFiveCharCodes = Array.from(cleanToken.substring(0, 5)).map(c => c.charCodeAt(0));
      tokenInfo.lastFiveCharCodes = Array.from(cleanToken.slice(-5)).map(c => c.charCodeAt(0));
      tokenInfo.envFirstFiveCharCodes = Array.from(cleanEnvToken.substring(0, 5)).map(c => c.charCodeAt(0));
      tokenInfo.envLastFiveCharCodes = Array.from(cleanEnvToken.slice(-5)).map(c => c.charCodeAt(0));
    }
    
    res.json(tokenInfo);
  } catch (error) {
    console.error('Token debug error:', error);
    res.status(500).json({ error: 'Failed to analyze token' });
  }
});

// Import simple authentication utilities
import { createSession, invalidateSession, getApiKey } from '../lib/simpleAuth.js';

// Login endpoint - create a new session
app.post('/api/auth/login', (req, res) => {
  try {
    const { password } = req.body;
    
    // Check if access key is provided (for CLI integration)
    const accessKey = req.query.access_key;
    if (accessKey && (accessKey === global.WEB_UI_ACCESS_KEY || accessKey === getApiKey())) {
      console.log('Access key authentication successful, creating session');
      const session = createSession();
      
      // Return both session token and API key for future requests
      return res.json({
        success: true,
        token: session.token,
        apiKey: getApiKey(),
        expiresAt: session.expiresAt
      });
    }
    
    // Check admin password (fallback authentication)
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
    if (password === adminPassword) {
      console.log('Password authentication successful, creating session');
      const session = createSession();
      
      return res.json({
        success: true,
        token: session.token,
        apiKey: getApiKey(),
        expiresAt: session.expiresAt
      });
    }
    
    // Development mode bypass
    if (process.env.NODE_ENV !== 'production' && password === 'dev') {
      console.log('Development mode authentication successful');
      const session = createSession();
      
      return res.json({
        success: true,
        token: session.token,
        apiKey: getApiKey(),
        expiresAt: session.expiresAt,
        message: 'WARNING: Development mode authentication'
      });
    }
    
    console.log('Invalid login attempt');
    res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Logout endpoint - invalidate session
app.post('/api/auth/logout', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      invalidateSession(token);
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Session validation endpoint
app.get('/api/auth/validate', (req, res) => {
  try {
    // Check for API key first
    const apiKey = req.headers['x-api-key'];
    if (apiKey && validateApiKey(apiKey)) {
      return res.json({ valid: true, method: 'api-key' });
    }
    
    // Then check for session token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token && validateSession(token)) {
      return res.json({ valid: true, method: 'session' });
    }
    
    // Development mode bypass
    if (process.env.NODE_ENV !== 'production' && 
        (req.headers['x-dev-mode'] === 'true' || token === 'dev-mode-token')) {
      return res.json({ valid: true, method: 'dev-mode' });
    }
    
    return res.json({ valid: false });
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
});

// API routes
// Environment variables endpoint
app.get('/api/env', authenticateToken, (req, res) => {
  try {
    // Only send non-sensitive environment variables
    const envVars = {
      API_PORT: process.env.API_PORT || '6987',
      API_HOST: process.env.API_HOST || '0.0.0.0',
      BOT_NAME: process.env.BOT_NAME || '',
      DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
      JWT_SECRET: process.env.JWT_SECRET || '',
      WEBHOOK_URL: process.env.WEBHOOK_URL || ''
    };
    res.json(envVars);
  } catch (error) {
    console.error('Error retrieving environment variables:', error);
    res.status(500).json({ error: 'Failed to retrieve environment variables' });
  }
});

app.post('/api/env', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    const envPath = path.join(__dirname, '../../.env');
    
    // Read existing .env file or create from defaults if it doesn't exist
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    } else {
      const defaultsPath = path.join(__dirname, '../../.env.defaults');
      if (fs.existsSync(defaultsPath)) {
        envContent = fs.readFileSync(defaultsPath, 'utf8');
      }
    }

    // Update environment variables
    const envLines = envContent.split('\n');
    const updatedLines = envLines.map(line => {
      const [key] = line.split('=');
      if (key && updates[key.trim()]) {
        return `${key.trim()}=${updates[key.trim()]}`;
      }
      return line;
    });

    // Add any new variables that weren't in the file
    Object.entries(updates).forEach(([key, value]) => {
      if (!envLines.some(line => line.startsWith(key))) {
        updatedLines.push(`${key}=${value}`);
      }
    });

    // Write back to .env file
    fs.writeFileSync(envPath, updatedLines.join('\n'));

    // Reload environment variables
    dotenv.config({ path: envPath });

    res.json({ message: 'Environment variables updated successfully' });
  } catch (error) {
    console.error('Error updating environment variables:', error);
    res.status(500).json({ error: 'Failed to update environment variables' });
  }
});

app.get('/api/status', authenticateToken, async (req, res) => {
  try {
    const status = botManager.client.user.presence.status;
    const currentChannel = botManager.client.channels.cache.get(botManager.currentChannelId);
    const uptime = process.uptime();
    const stats = botManager.getUsageStats();

    res.json({
      status,
      currentChannel: currentChannel ? currentChannel.name : 'None',
      uptime,
      ...stats
    });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: 'Failed to retrieve status' });
  }
});

app.post('/api/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const result = await botManager.changeStatus(status);
    res.json({ message: result });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: error.message || 'Failed to change status' });
  }
});

app.get('/api/logs', authenticateToken, (req, res) => {
  try {
    // Force refresh logs from file system
    const logs = botManager ? botManager.getLogs() : [];
    
    // If no logs are available, return an empty array with a message
    if (!logs || logs.length === 0) {
      return res.json({ 
        logs: [],
        message: 'No logs available. The application may have just started or logging is disabled.'
      });
    }
    
    res.json({ logs });
  } catch (error) {
    console.error('Error retrieving logs:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve logs',
      message: error.message
    });
  }
});

app.post('/api/commands', authenticateToken, async (req, res) => {
  try {
    const { command, args = [] } = req.body;
    
    if (!botManager) {
      throw new Error('Bot manager not initialized');
    }

    // Log incoming command request
    console.log('Command request received:', { command, args });

    let result;
    switch (command.toLowerCase()) {
      case 'fact':
        const response = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
        result = response.data.text;
        break;

      case 'status':
        if (!args[0] || !['online', 'idle', 'dnd', 'invisible'].includes(args[0])) {
          throw new Error('Invalid status. Must be one of: online, idle, dnd, invisible');
        }
        result = await botManager.changeStatus(args[0]);
        break;

      case 'help':
        result = [
          '**Available Commands:**',
          '`/fact` - Get a random fact',
          '`/status <newstatus>` - Change bot status (online, idle, dnd, invisible)',
          '`/help` - Show this help message'
        ].join('\n');
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    // Log the command execution
    console.log(`Command executed: ${command}`, { args, result });
    
    // Send the response
    res.json({ 
      success: true,
      result: result || 'Command executed successfully'
    });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: error.message || 'Failed to execute command' });
  }
});

app.get('/api/channels', authenticateToken, async (req, res) => {
  try {
    if (!botManager) {
      return res.status(500).json({ 
        error: 'Bot manager not initialized',
        channels: []
      });
    }
    
    console.log('Fetching channels list...');
    const channels = await botManager.listChannels();
    
    console.log(`Found ${channels.length} channels`);
    
    // Add current channel indicator
    if (botManager.currentChannelId) {
      channels.forEach(channel => {
        channel.isActive = channel.id === botManager.currentChannelId;
      });
    }
    
    res.json({
      success: true,
      channels,
      currentChannelId: botManager.currentChannelId || null
    });
  } catch (error) {
    console.error('Error listing channels:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to list channels',
      channels: []
    });
  }
});

// Message history endpoint
app.get('/api/messages/:channelId', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 50 } = req.query;
    
    const channel = await botManager.client.channels.fetch(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const messages = await channel.messages.fetch({ limit: Number(limit) });
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      author: msg.author.username,
      timestamp: msg.createdTimestamp,
      attachments: msg.attachments.map(a => ({
        id: a.id,
        url: a.url,
        name: a.name
      }))
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Message deletion endpoint
app.delete('/api/messages/:channelId/:messageId', authenticateToken, async (req, res) => {
  try {
    const { channelId, messageId } = req.params;
    const channel = await botManager.client.channels.fetch(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    
    const message = await channel.messages.fetch(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    await message.delete();
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Message editing endpoint
app.patch('/api/messages/:channelId/:messageId', authenticateToken, async (req, res) => {
  try {
    const { channelId, messageId } = req.params;
    const { content } = req.body;
    
    const channel = await botManager.client.channels.fetch(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    
    const message = await channel.messages.fetch(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    await message.edit(content);
    res.json({ message: 'Message edited successfully' });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

app.post('/api/send', authenticateToken, async (req, res) => {
  try {
    const { message, channelId, threadId } = req.body;
    
    if (!message || !channelId) {
      return res.status(400).json({ error: 'Message and channelId are required' });
    }

    if (!botManager) {
      return res.status(500).json({ error: 'Bot manager not initialized' });
    }

    console.log('Sending message:', { 
      messageLength: message.length,
      channelId,
      threadId: threadId || 'none'
    });

    const result = await botManager.sendMessage(message, channelId, threadId);
    res.json({ 
      success: true, 
      message: 'Message sent successfully',
      result
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to send message' 
    });
  }
});

app.post('/api/channel', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.body;
    
    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }
    
    if (!botManager) {
      return res.status(500).json({ error: 'Bot manager not initialized' });
    }
    
    const result = await botManager.setActiveChannel(channelId);
    console.log('Channel set successfully:', channelId);
    res.json({ success: true, message: result });
  } catch (error) {
    console.error('Error setting active channel:', error);
    res.status(500).json({ error: error.message || 'Failed to set active channel' });
  }
});

app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    if (!botManager) {
      return res.status(500).json({ 
        error: 'Bot manager not initialized',
        botStatus: 'unavailable'
      });
    }
    
    const stats = botManager.getUsageStats();
    
    // Add additional debug info
    stats.botInitialized = !!botManager;
    stats.clientReady = botManager.client && botManager.client.isReady();
    stats.currentChannelId = botManager.currentChannelId || null;
    
    res.json(stats);
  } catch (error) {
    console.error('Error retrieving statistics:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

// Add a debug endpoint to check bot status
app.get('/api/debug/bot', authenticateToken, async (req, res) => {
  try {
    const botStatus = {
      initialized: !!botManager,
      clientReady: botManager && botManager.client && botManager.client.isReady(),
      currentChannelId: botManager && botManager.currentChannelId,
      uptime: process.uptime(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      env: {
        API_PORT: process.env.API_PORT,
        API_HOST: process.env.API_HOST,
        NODE_ENV: process.env.NODE_ENV
      }
    };
    
    res.json(botStatus);
  } catch (error) {
    console.error('Error retrieving bot status:', error);
    res.status(500).json({ error: 'Failed to retrieve bot status' });
  }
});

// Add a dedicated endpoint to refresh logs
app.post('/api/logs/refresh', authenticateToken, (req, res) => {
  try {
    if (!botManager) {
      return res.status(500).json({ error: 'Bot manager not initialized' });
    }
    
    // Force reload logs from file
    botManager.refreshLogs();
    const logs = botManager.getLogs();
    
    res.json({ 
      logs,
      message: 'Logs refreshed successfully',
      count: logs.length
    });
  } catch (error) {
    console.error('Error refreshing logs:', error);
    res.status(500).json({ error: 'Failed to refresh logs' });
  }
});

app.post('/api/restart', authenticateToken, async (req, res) => {
  try {
    if (!botManager) {
      throw new Error('Bot manager not initialized');
    }

    const result = await botManager.restart();
    res.json({ message: result });
  } catch (error) {
    console.error('Error restarting bot:', error);
    res.status(500).json({ error: error.message || 'Failed to restart bot' });
  }
});

// Serve webpack bundle and static files
app.use(express.static(path.join(__dirname, '../../src/public')));

// Handle root route and all non-API routes
app.get(/^(?!\/api\/).+/, (req, res) => {
  res.sendFile(path.join(__dirname, '../../src/public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Handle 404s by serving index.html
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
    return;
  }
  res.sendFile(path.join(__dirname, '../../src/public/index.html'), {
    headers: {
      'Content-Type': 'text/html'
    }
  });
});


// Route to start/stop the server
// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  try {
    // Check for API key in handshake auth
    const apiKey = socket.handshake.auth.api_key;
    if (apiKey && validateApiKey(apiKey)) {
      console.log('Socket.IO: API key authentication successful');
      socket.user = { authorized: true };
      next();
      return;
    }
    
    // Check for access key in handshake auth
    const accessKey = socket.handshake.auth.access_key;
    if (accessKey && (accessKey === global.WEB_UI_ACCESS_KEY || validateApiKey(accessKey))) {
      console.log('Socket.IO: Access key authentication successful');
      socket.user = { authorized: true };
      next();
      return;
    }
    
    // Check for session token
    const token = socket.handshake.auth.token;
    if (token && validateSession(token)) {
      console.log('Socket.IO: Session token authentication successful');
      socket.user = { authorized: true };
      next();
      return;
    }
    
    // Development mode bypass
    if (process.env.NODE_ENV !== 'production' && 
        (token === 'dev-mode-token' || socket.handshake.auth.dev_mode === 'true')) {
      console.log('Socket.IO: Development mode authentication successful');
      socket.user = { authorized: true, devMode: true };
      next();
      return;
    }
    
    console.error('Socket.IO: No valid authentication provided');
    next(new Error('Authentication required'));
  } catch (error) {
    console.error('Socket.IO authentication error:', error);
    next(new Error(`Authentication error: ${error.message}`));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected');
  
  const pingInterval = setInterval(() => {
    socket.emit('ping');
  }, 30000);
  
  socket.on('pong', () => {
    socket.lastPong = Date.now();
  });
  
  socket.on('disconnect', (reason) => {
    clearInterval(pingInterval);
    console.log(`Client disconnected: ${reason}`);
    if (reason === 'transport close') {
      socket.connect();
    }
  });

  // Handle command events from client
  socket.on('command', async (data) => {
    try {
      const { command, args = [] } = data;
      let result;
      
      switch (command) {
        case 'fact':
          const response = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
          result = response.data.text;
          break;
          
        case 'status':
          if (!args[0] || !['online', 'idle', 'dnd', 'invisible'].includes(args[0])) {
            throw new Error('Invalid status. Must be one of: online, idle, dnd, invisible');
          }
          result = await botManager.changeStatus(args[0]);
          break;
          
        case 'help':
          result = [
            '**Available Commands:**',
            '`/fact` - Get a random fact',
            '`/status <newstatus>` - Change bot status (online, idle, dnd, invisible)',
            '`/help` - Show this help message'
          ].join('\n');
          break;
          
        default:
          throw new Error(`Unknown command: ${command}`);
      }
      
      socket.emit('commandResponse', { 
        success: true, 
        command,
        result 
      });
    } catch (error) {
      socket.emit('commandResponse', { 
        success: false,
        command: data.command, 
        error: error.message || 'Command execution failed' 
      });
    }
  });
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
    socket.connect();
  });
});

