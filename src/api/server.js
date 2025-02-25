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

// Authentication middleware
function authenticateToken(req, res, next) {
  try {
    // Check for access key in query parameters (for initial auth only)
    const accessKey = req.query.access_key;
    if (accessKey && global.WEB_UI_ACCESS_KEY && accessKey === global.WEB_UI_ACCESS_KEY) {
      console.log('Access key authentication successful');
      req.user = { authorized: true };
      next();
      return;
    }
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    // First check if Discord token is configured
    if (!process.env.DISCORD_TOKEN) {
      console.error('DISCORD_TOKEN not configured in environment');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!token) {
      // Silently return 401 without logging
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Compare directly with Discord token
    if (token && process.env.DISCORD_TOKEN) {
      // Remove any Bearer prefix if present and trim whitespace
      const cleanToken = token.trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
      const cleanEnvToken = process.env.DISCORD_TOKEN.trim().replace(/\s+/g, '');
        
      // More detailed debug logging
      console.log(`Auth attempt - Token length: ${cleanToken.length}, Env token length: ${cleanEnvToken.length}`);
      console.log(`Auth token first 5 chars: ${cleanToken.substring(0, 5)}, Env token first 5 chars: ${cleanEnvToken.substring(0, 5)}`);
      console.log(`Auth token last 5 chars: ${cleanToken.slice(-5)}, Env token last 5 chars: ${cleanEnvToken.slice(-5)}`);
        
      // Simple direct comparison without any token cleaning
      if (token === process.env.DISCORD_TOKEN) {
        console.log('Direct token match successful');
        req.user = { authorized: true };
        next();
        return;
      }
      
      // Check for web UI token from URL parameter
      const webUiToken = process.env.WEB_UI_TOKEN || process.env.DISCORD_TOKEN;
      if (webUiToken && token === webUiToken) {
        console.log('Web UI token authentication successful');
        req.user = { authorized: true };
        next();
        return;
      }
      
      // Fallback to case-insensitive comparison as last resort
      if (token.toLowerCase() === process.env.DISCORD_TOKEN.toLowerCase()) {
        console.log('Case-insensitive token match successful');
        req.user = { authorized: true };
        next();
        return;
      }
    }
    
    // Log the error but don't expose token details
    console.error('Invalid authentication token detected');
    return res.status(403).json({ error: 'Invalid authentication token' });
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

// Access key endpoint - exchange temporary access key for actual token
app.get('/api/auth/exchange', (req, res) => {
  try {
    const { access_key } = req.query;
    
    // Check if the access key is valid
    if (access_key && global.WEB_UI_ACCESS_KEY && access_key === global.WEB_UI_ACCESS_KEY) {
      // Return the actual Discord token
      res.json({ 
        token: process.env.DISCORD_TOKEN,
        success: true
      });
      
      // Invalidate the access key after use (one-time use)
      global.WEB_UI_ACCESS_KEY = null;
    } else {
      res.status(403).json({ error: 'Invalid access key' });
    }
  } catch (error) {
    console.error('Access key exchange error:', error);
    res.status(500).json({ error: 'Authentication failed' });
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
    const channels = await botManager.listChannels();
    res.json(channels);
  } catch (error) {
    console.error('Error listing channels:', error);
    res.status(500).json({ error: 'Failed to list channels' });
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

    const result = await botManager.sendMessage(message, channelId, threadId);
    res.json({ message: result });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

app.post('/api/channel', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.body;
    await botManager.setActiveChannel(channelId);
    res.json({ message: 'Channel set successfully' });
  } catch (error) {
    console.error('Error setting active channel:', error);
    res.status(500).json({ error: 'Failed to set active channel' });
  }
});

app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const stats = botManager.getUsageStats();
    res.json(stats);
  } catch (error) {
    console.error('Error retrieving statistics:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
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
    // Check for access key in handshake auth
    const accessKey = socket.handshake.auth.access_key;
    if (accessKey && global.WEB_UI_ACCESS_KEY && accessKey === global.WEB_UI_ACCESS_KEY) {
      console.log('Socket.IO: Access key authentication successful');
      socket.user = { authorized: true };
      next();
      return;
    }
    
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log('Socket.IO: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }
    
    // Check if Discord token is configured
    if (!process.env.DISCORD_TOKEN) {
      console.error('Socket.IO: DISCORD_TOKEN not configured');
      return next(new Error('Server configuration error: Discord token not set'));
    }
    
    // Direct comparison with Discord token
    // Remove any Bearer prefix if present and clean thoroughly
    const cleanToken = token.trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
    const cleanEnvToken = process.env.DISCORD_TOKEN.trim().replace(/\s+/g, '');
    
    // More detailed debug logging
    console.log(`Socket auth attempt - Token length: ${cleanToken.length}, Env token length: ${cleanEnvToken.length}`);
    console.log(`Socket auth token first 5 chars: ${cleanToken.substring(0, 5)}, Env token first 5 chars: ${cleanEnvToken.substring(0, 5)}`);
    console.log(`Socket auth token last 5 chars: ${cleanToken.slice(-5)}, Env token last 5 chars: ${cleanEnvToken.slice(-5)}`);
    
    // Simple direct comparison without any token cleaning
    if (token === process.env.DISCORD_TOKEN) {
      socket.user = { authorized: true };
      console.log('Socket.IO: Authentication successful (direct match)');
      next();
      return;
    }
    
    // Check for web UI token from URL parameter
    const webUiToken = process.env.WEB_UI_TOKEN || process.env.DISCORD_TOKEN;
    if (webUiToken && token === webUiToken) {
      console.log('Socket.IO: Web UI token authentication successful');
      socket.user = { authorized: true };
      next();
      return;
    }
    
    // Fallback to case-insensitive comparison as last resort
    if (token.toLowerCase() === process.env.DISCORD_TOKEN.toLowerCase()) {
      console.log('Socket.IO: Case-insensitive token match successful');
      socket.user = { authorized: true };
      console.log('Socket.IO: Authentication successful');
      next();
    } else {
      console.error('Socket.IO: Invalid authentication token');
      next(new Error('Invalid authentication token'));
    }
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

