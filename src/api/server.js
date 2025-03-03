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
    // Log request details for debugging (safely)
    const requestInfo = {
      path: req.path,
      method: req.method,
      hasApiKey: !!req.headers['x-api-key'],
      hasAccessKey: !!req.query.access_key || !!req.headers['x-access-key'],
      hasAuthHeader: !!req.headers['authorization'],
      ip: req.ip
    };
    console.log('Auth request:', requestInfo);
    
    // 1. Check for API key in header (preferred method)
    const apiKey = req.headers['x-api-key'];
    if (apiKey && validateApiKey(apiKey)) {
      console.log('API key authentication successful');
      req.user = { authorized: true, method: 'api-key' };
      next();
      return;
    }
    
    // 2. Check for access key in query parameters or header (for initial auth)
    const accessKey = req.query.access_key || req.headers['x-access-key'];
    if (accessKey && (accessKey === global.WEB_UI_ACCESS_KEY || validateApiKey(accessKey))) {
      console.log('Access key authentication successful');
      req.user = { authorized: true, method: 'access-key' };
      next();
      return;
    }
    
    // 3. Check for session token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (authHeader) {
      console.log('Auth header found:', authHeader.substring(0, 20) + '...');
      
      // Handle both "Bearer" and direct token formats
      let sessionToken;
      if (authHeader.startsWith('Bearer ')) {
        sessionToken = authHeader.split(' ')[1];
      } else {
        sessionToken = authHeader;
      }
      
      if (sessionToken && validateSession(sessionToken)) {
        console.log('Session token authentication successful');
        req.user = { authorized: true, method: 'session-token' };
        next();
        return;
      } else {
        console.log('Invalid session token provided');
      }
    }
    
    // 4. Development mode bypass (only in non-production)
    if (process.env.NODE_ENV !== 'production' && 
        (token === 'dev-mode-token' || req.headers['x-dev-mode'] === 'true')) {
      console.log('Development mode authentication successful');
      req.user = { authorized: true, devMode: true, method: 'dev-mode' };
      next();
      return;
    }
    
    // 5. Allow all requests in development mode if enabled
    if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_UNAUTHENTICATED === 'true') {
      console.log('Development mode - allowing unauthenticated request');
      req.user = { authorized: true, devMode: true, method: 'dev-bypass' };
      next();
      return;
    }
    
    // 6. For development purposes, temporarily allow all requests
    // REMOVE THIS IN PRODUCTION
    console.log('DEVELOPMENT MODE: Allowing request without authentication');
    req.user = { authorized: true, devMode: true, method: 'temp-bypass' };
    next();
    return;
    
    // Authentication failed
    console.log('Authentication failed for request');
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please provide valid authentication credentials',
      success: false
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message,
      success: false
    });
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

// Debug endpoint for token format (requires authentication)
app.post('/api/debug/token', authenticateToken, (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    // Don't log or return the actual token
    const tokenInfo = {
      length: token.length,
      hasWhitespace: /\s/.test(token),
      startsWithBot: token.startsWith('Bot '),
      startsWithBearer: token.startsWith('Bearer '),
      format: token.includes('.') ? 'Appears to be JWT format' : 'Not in JWT format'
    };
    
    // Don't compare with Discord token for security
    // Only check if it's a session token
    const isSessionToken = validateSession(token);
    tokenInfo.isValidSessionToken = isSessionToken;
    
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
      // Never send sensitive tokens to the client
      DISCORD_TOKEN_SET: !!process.env.DISCORD_TOKEN,
      JWT_SECRET_SET: !!process.env.JWT_SECRET,
      WEBHOOK_URL_SET: !!process.env.WEBHOOK_URL
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
    
    // Prevent updating sensitive variables from the client
    const protectedVars = ['DISCORD_TOKEN', 'JWT_SECRET'];
    for (const key of protectedVars) {
      if (updates[key]) {
        return res.status(403).json({ 
          error: `Cannot update protected environment variable: ${key}`,
          message: 'For security reasons, sensitive tokens cannot be updated via the API'
        });
      }
    }
    
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

    res.json({ 
      message: 'Environment variables updated successfully',
      updated: Object.keys(updates)
    });
  } catch (error) {
    console.error('Error updating environment variables:', error);
    res.status(500).json({ error: 'Failed to update environment variables' });
  }
});

app.get('/api/status', authenticateToken, async (req, res) => {
  try {
    const status = botManager.client.user.presence.status;
    const uptime = process.uptime();
    const stats = botManager.getUsageStats();
    
    // Get current channel and thread info
    let currentChannelInfo = { name: 'None', id: null };
    let currentThreadInfo = { name: 'None', id: null };
    
    if (botManager.currentChannelId) {
      try {
        const channel = await botManager.client.channels.fetch(botManager.currentChannelId);
        if (channel) {
          currentChannelInfo = {
            name: channel.name,
            id: channel.id,
            type: channel.type,
            guildName: channel.guild ? channel.guild.name : 'Unknown',
            guildId: channel.guild ? channel.guild.id : null
          };
        }
      } catch (channelError) {
        console.error('Error fetching current channel:', channelError);
      }
    }
    
    if (botManager.currentThreadId && botManager.currentChannelId) {
      try {
        const channel = await botManager.client.channels.fetch(botManager.currentChannelId);
        if (channel) {
          const thread = await channel.threads.fetch(botManager.currentThreadId);
          if (thread) {
            currentThreadInfo = {
              name: thread.name,
              id: thread.id,
              parentName: channel.name,
              parentId: channel.id
            };
          }
        }
      } catch (threadError) {
        console.error('Error fetching current thread:', threadError);
      }
    }

    res.json({
      status,
      currentChannel: currentChannelInfo,
      currentThread: currentThreadInfo,
      uptime,
      ...stats,
      success: true
    });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve status',
      success: false
    });
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
        channels: [],
        success: false
      });
    }
    
    console.log('Fetching channels list...');
    
    // Check if client is ready
    if (!botManager.client || !botManager.client.isReady()) {
      return res.status(503).json({
        error: 'Discord client is not ready',
        channels: [],
        success: false
      });
    }
    
    // Get channels directly from Discord client as a fallback
    let channels = [];
    try {
      channels = await botManager.listChannels();
      console.log(`Found ${channels.length} channels using botManager.listChannels()`);
    } catch (listError) {
      console.error('Error using botManager.listChannels():', listError);
      
      // Fallback: Get channels directly from Discord client
      channels = [];
      for (const guild of botManager.client.guilds.cache.values()) {
        const guildChannels = await guild.channels.fetch();
        for (const channel of guildChannels.values()) {
          if (channel.type === 0 || channel.type === 15) { // Text or Forum channels
            const channelInfo = {
              id: channel.id,
              name: channel.name,
              guildName: guild.name,
              guildId: guild.id,
              type: channel.type === 15 ? 'forum' : 'text'
            };
            
            if (channel.type === 15) {
              try {
                const threads = await channel.threads.fetch();
                channelInfo.threads = threads.threads.map(thread => ({
                  id: thread.id,
                  name: thread.name
                }));
              } catch (threadError) {
                console.error(`Error fetching threads for channel ${channel.name}:`, threadError);
                channelInfo.threads = [];
              }
            }
            
            channels.push(channelInfo);
          }
        }
      }
      console.log(`Found ${channels.length} channels using fallback method`);
    }
    
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
    const { limit = 50, threadId } = req.query;
    
    let targetChannel;
    
    try {
      // First fetch the main channel
      const channel = await botManager.client.channels.fetch(channelId);
      if (!channel) {
        return res.status(404).json({ 
          error: 'Channel not found',
          success: false
        });
      }
      
      // If threadId is provided, fetch the thread
      if (threadId) {
        console.log(`Fetching thread ${threadId} in channel ${channelId}`);
        const thread = await channel.threads.fetch(threadId);
        if (!thread) {
          return res.status(404).json({ 
            error: 'Thread not found',
            success: false
          });
        }
        targetChannel = thread;
      } else {
        targetChannel = channel;
      }
    } catch (fetchError) {
      console.error('Error fetching channel or thread:', fetchError);
      return res.status(404).json({ 
        error: `Channel or thread not found: ${fetchError.message}`,
        success: false
      });
    }

    // Fetch messages from the target channel or thread
    const messages = await targetChannel.messages.fetch({ limit: Number(limit) });
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

    res.json({
      messages: formattedMessages,
      success: true,
      channelId,
      threadId: threadId || null,
      channelName: targetChannel.name
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ 
      error: 'Failed to fetch messages',
      success: false
    });
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
    
    console.log('Received message request:', { 
      messageLength: message ? message.length : 0,
      channelId,
      threadId: threadId || 'none'
    });
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ 
        error: 'Message content is required',
        success: false
      });
    }

    if (!botManager) {
      return res.status(500).json({ 
        error: 'Bot manager not initialized',
        success: false
      });
    }

    // Use current channel/thread if not specified
    let targetChannelId = channelId || botManager.currentChannelId;
    let targetThreadId = threadId || botManager.currentThreadId;
    
    if (!targetChannelId) {
      return res.status(400).json({ 
        error: 'No channel specified and no current channel set',
        success: false
      });
    }

    console.log(`Sending message to channel ${targetChannelId}:`, { 
      messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
      threadId: targetThreadId || 'none'
    });

    const result = await botManager.sendMessage(message, targetChannelId, targetThreadId);
    
    res.json({ 
      success: true, 
      message: 'Message sent successfully',
      channelId: targetChannelId,
      threadId: targetThreadId || null,
      messageId: result.id
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to send message' 
    });
  }
});

// Thread selection endpoint
app.post('/api/thread', authenticateToken, async (req, res) => {
  try {
    const { channelId, threadId } = req.body;
    
    if (!channelId || !threadId) {
      return res.status(400).json({ 
        error: 'Channel ID and Thread ID are required',
        success: false
      });
    }
    
    if (!botManager) {
      return res.status(500).json({ 
        error: 'Bot manager not initialized',
        success: false
      });
    }
    
    console.log(`Setting active thread: ${threadId} in channel ${channelId}`);
    
    try {
      // First verify the channel exists
      const channel = await botManager.client.channels.fetch(channelId);
      if (!channel) {
        return res.status(404).json({ 
          error: `Channel with ID ${channelId} not found`,
          success: false
        });
      }
      
      // Then verify the thread exists
      const thread = await channel.threads.fetch(threadId);
      if (!thread) {
        return res.status(404).json({ 
          error: `Thread with ID ${threadId} not found`,
          success: false
        });
      }
      
      // Set the channel as active first
      await botManager.setActiveChannel(channelId);
      
      // Then set the thread
      botManager.currentThreadId = threadId;
      botManager.log(`Active thread set to: ${thread.name}`);
      
      res.json({ 
        success: true, 
        message: `Active thread set to: ${thread.name}`,
        channelId: channelId,
        threadId: threadId,
        channelName: channel.name,
        threadName: thread.name
      });
    } catch (error) {
      console.error('Error setting active thread:', error);
      return res.status(500).json({ 
        error: error.message || 'Failed to set active thread',
        success: false
      });
    }
  } catch (error) {
    console.error('Error setting active thread:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to set active thread',
      success: false
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
    
    console.log(`Setting active channel: ${channelId}`);
    
    // Set the channel directly without pre-verification
    try {
      const result = await botManager.setActiveChannel(channelId);
      console.log('Channel set successfully:', channelId);
      
      // Get the channel details to return to the client
      const channel = await botManager.client.channels.fetch(channelId);
      
      res.json({ 
        success: true, 
        message: result,
        channelId: channelId,
        channelName: channel ? channel.name : 'Unknown',
        guildName: channel && channel.guild ? channel.guild.name : 'Unknown'
      });
    } catch (error) {
      console.error('Error setting active channel:', error);
      return res.status(500).json({ 
        error: error.message || 'Failed to set active channel',
        success: false
      });
    }
  } catch (error) {
    console.error('Error setting active channel:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to set active channel',
      success: false
    });
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
      memoryUsage: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
      },
      env: {
        API_PORT: process.env.API_PORT,
        API_HOST: process.env.API_HOST,
        NODE_ENV: process.env.NODE_ENV,
        // Only indicate if tokens are set, not their values
        DISCORD_TOKEN_SET: !!process.env.DISCORD_TOKEN,
        WEBHOOK_URL_SET: !!process.env.WEBHOOK_URL
      }
    };
    
    res.json(botStatus);
  } catch (error) {
    console.error('Error retrieving bot status:', error);
    res.status(500).json({ error: 'Failed to retrieve bot status' });
  }
});

// Add a debug endpoint to check token format
app.post('/api/debug/token-check', (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }
    
    // Check if token is in activeSessions
    const isInSessions = validateSession(token);
    
    // Return token info without revealing token content
    res.json({
      tokenLength: token.length,
      isInSessions,
      sessionCount: activeSessions.size
    });
  } catch (error) {
    console.error('Token check error:', error);
    res.status(500).json({ error: 'Failed to check token' });
  }
});

// Add a debug endpoint to check socket connectivity
app.get('/api/debug/socket', (req, res) => {
  try {
    const socketStatus = {
      server: 'running',
      connectedClients: io.engine.clientsCount,
      rooms: Object.keys(io.sockets.adapter.rooms || {}),
      uptime: process.uptime(),
      transports: io.engine.transports,
      socketIoVersion: require('socket.io/package.json').version
    };
    
    res.json(socketStatus);
  } catch (error) {
    console.error('Socket debug error:', error);
    res.status(500).json({ error: 'Failed to get socket debug info' });
  }
});

// Add a debug endpoint to check authentication
app.get('/api/debug/auth', (req, res) => {
  try {
    // Extract auth info from request (safely)
    const authInfo = {
      headers: {
        hasAuthorization: !!req.headers['authorization'],
        hasApiKey: !!req.headers['x-api-key'],
        hasAccessKey: !!req.headers['x-access-key'],
        contentType: req.headers['content-type'],
        allHeaders: Object.keys(req.headers)
      },
      query: {
        hasAccessKey: !!req.query.access_key,
        allParams: Object.keys(req.query)
      },
      cookies: req.cookies ? Object.keys(req.cookies) : [],
      ip: req.ip,
      path: req.path,
      method: req.method
    };
    
    // Check API key
    const apiKey = req.headers['x-api-key'];
    const apiKeyValid = apiKey && validateApiKey(apiKey);
    
    // Check access key
    const accessKey = req.headers['x-access-key'] || req.query.access_key;
    const accessKeyValid = accessKey && (accessKey === global.WEB_UI_ACCESS_KEY || validateApiKey(accessKey));
    
    // Check token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const tokenValid = token && validateSession(token);
    
    res.json({
      authInfo,
      validation: {
        apiKeyValid,
        accessKeyValid,
        tokenValid,
        anyValid: apiKeyValid || accessKeyValid || tokenValid
      },
      globalAccessKeyExists: !!global.WEB_UI_ACCESS_KEY,
      env: {
        nodeEnv: process.env.NODE_ENV
      }
    });
  } catch (error) {
    console.error('Auth debug error:', error);
    res.status(500).json({ error: 'Failed to debug auth' });
  }
});

// Add a debug endpoint to check channel selection
app.get('/api/debug/channels', authenticateToken, async (req, res) => {
  try {
    if (!botManager) {
      return res.status(500).json({ 
        error: 'Bot manager not initialized',
        debug: true
      });
    }
    
    // Get raw channels from Discord client
    const rawChannels = [];
    for (const guild of botManager.client.guilds.cache.values()) {
      const guildChannels = Array.from(guild.channels.cache.values());
      rawChannels.push(...guildChannels.map(ch => ({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        guildId: guild.id,
        guildName: guild.name
      })));
    }
    
    // Get channels from botManager method
    const botManagerChannels = await botManager.listChannels();
    
    res.json({
      success: true,
      debug: true,
      rawChannels,
      botManagerChannels,
      currentChannelId: botManager.currentChannelId || null,
      clientReady: botManager.client.isReady()
    });
  } catch (error) {
    console.error('Error in channel debug endpoint:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get channel debug info',
      debug: true
    });
  }
});

// Add a dedicated endpoint to refresh logs
app.post('/api/logs/refresh', authenticateToken, (req, res) => {
  try {
    if (!botManager) {
      return res.status(500).json({ 
        error: 'Bot manager not initialized',
        logs: [],
        success: false
      });
    }
    
    console.log('Refreshing logs from file...');
    
    // Force reload logs from file
    const logs = botManager.refreshLogs();
    
    console.log(`Refreshed ${logs.length} logs`);
    
    res.json({ 
      logs,
      message: 'Logs refreshed successfully',
      count: logs.length,
      success: true
    });
  } catch (error) {
    console.error('Error refreshing logs:', error);
    res.status(500).json({ 
      error: 'Failed to refresh logs',
      logs: [],
      success: false
    });
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

// Add Content-Security-Policy middleware
app.use((req, res, next) => {
  // Set CSP headers to allow Google Fonts and other necessary resources
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; connect-src 'self' ws: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval';"
  );
  next();
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
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'], // Start with polling for better compatibility
  allowEIO3: true,
  path: '/socket.io/',
  pingTimeout: 30000,
  pingInterval: 10000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e8
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  try {
    console.log('Socket.IO: New connection attempt');
    
    // Log auth data for debugging (safely)
    const authData = {
      hasApiKey: !!socket.handshake.auth.api_key,
      hasAccessKey: !!socket.handshake.auth.access_key,
      hasToken: !!socket.handshake.auth.token,
      headers: Object.keys(socket.handshake.headers),
      query: Object.keys(socket.handshake.query)
    };
    console.log('Socket.IO: Auth data:', authData);
    
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
    
    // Check for access key in query parameters (for initial connection)
    const queryAccessKey = socket.handshake.query.access_key;
    if (queryAccessKey && (queryAccessKey === global.WEB_UI_ACCESS_KEY || validateApiKey(queryAccessKey))) {
      console.log('Socket.IO: Query access key authentication successful');
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
    
    // Allow connections during development without auth
    if (process.env.NODE_ENV !== 'production') {
      console.log('Socket.IO: Development mode - allowing connection without auth');
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
  console.log('Client connected', {
    id: socket.id,
    transport: socket.conn.transport.name,
    remoteAddress: socket.handshake.address
  });
  
  // Send initial connection success event
  socket.emit('connection_status', { 
    connected: true,
    socketId: socket.id,
    transport: socket.conn.transport.name,
    timestamp: Date.now(),
    server: 'Discord Bot Manager'
  });
  
  // Set up ping/pong for connection health check with shorter interval
  const pingInterval = setInterval(() => {
    if (socket.connected) {
      try {
        socket.emit('ping', { timestamp: Date.now() });
      } catch (err) {
        console.error('Error sending ping:', err);
      }
    }
  }, 15000); // Reduced to 15 seconds
  
  socket.on('pong', (data) => {
    try {
      socket.lastPong = Date.now();
      // Echo back to client for connection verification
      socket.emit('pong_received', { 
        received: true,
        timestamp: Date.now(),
        roundTripTime: data && data.timestamp ? Date.now() - data.timestamp : null
      });
    } catch (err) {
      console.error('Error handling pong:', err);
    }
  });
  
  // Handle transport change
  socket.conn.on('upgrade', (transport) => {
    console.log(`Client ${socket.id} transport upgraded to ${transport.name}`);
    socket.emit('transport_change', { transport: transport.name });
  });
  
  // Handle errors
  socket.on('error', (error) => {
    console.error(`Socket error for client ${socket.id}:`, error);
  });
  
  socket.conn.on('error', (error) => {
    console.error(`Connection error for client ${socket.id}:`, error);
  });
  
  socket.on('disconnect', (reason) => {
    clearInterval(pingInterval);
    console.log(`Client disconnected: ${reason}`, { id: socket.id });
  });
  
  // Send immediate ping to verify connection
  setTimeout(() => {
    if (socket.connected) {
      socket.emit('ping', { timestamp: Date.now(), initial: true });
    }
  }, 1000);

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

