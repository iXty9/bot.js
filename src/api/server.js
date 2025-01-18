const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Load environment variables
const envPath = path.join(__dirname, '../../.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found');
  process.exit(1);
}

dotenv.config({ path: envPath });

// Validate required environment variables
if (!process.env.DISCORD_TOKEN) {
  console.error('Error: DISCORD_TOKEN is required in .env file');
  process.exit(1);
}

if (process.env.DISCORD_TOKEN === 'your-token-here' || process.env.DISCORD_TOKEN.trim() === '') {
  console.error('Error: Please configure a valid DISCORD_TOKEN in .env file');
  process.exit(1);
}

const { Server } = require('socket.io');
const http = require('http');
const BotManager = require('../BotManager');
const app = express();
const PORT = process.env.API_PORT || 6987;
const HOST = process.env.API_HOST || '0.0.0.0';
app.set('trust proxy', true);
const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
  console.error('JWT_SECRET environment variable is required');
  process.exit(1);
}

app.use(cors());
app.use(bodyParser.json());

// Authentication middleware
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    // First check if Discord token is configured
    if (!process.env.DISCORD_TOKEN) {
      console.error('DISCORD_TOKEN not configured in environment');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!token) {
      console.error('No authentication token provided');
      return res.status(401).json({ error: 'Authentication required' });
    }

    jwt.verify(token, secretKey, (err, user) => {
      if (err) {
        console.error('Invalid token provided');
        return res.status(403).json({ error: 'Invalid authentication token' });
      }
      req.user = user;
      next();
    });
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
      if (!botManager) {
        botManager = new BotManager(client, process.env.WEBHOOK_URL);
        // Wait for bot manager to be ready
        botManager.on('ready', () => {
          resolve(botManager);
        });
      } else {
        resolve(botManager);
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Export for use in index.js
module.exports = { initializeBotManager, app };

// API routes
// Environment variables endpoint
app.get('/api/env', authenticateToken, (req, res) => {
  try {
    // Only send non-sensitive environment variables
    const envVars = {
      API_PORT: process.env.API_PORT || '6987',
      API_HOST: process.env.API_HOST || '0.0.0.0',
      BOT_NAME: process.env.BOT_NAME || ''
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
    const logs = botManager.getLogs();
    res.json({ logs });
  } catch (error) {
    console.error('Error retrieving logs:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
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

// Serve webpack bundle and static files
app.use(express.static(path.join(__dirname, '../../src/public')));

// Handle root route and all non-API routes
app.get(/^(?!\/api\/).+/, (req, res) => {
  res.sendFile(path.join(__dirname, '../../src/public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  
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
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  if (token === process.env.DISCORD_TOKEN) {
    next();
  } else {
    next(new Error('Invalid token'));
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

// Export the server instance so we can start it from index.js
module.exports = { 
  initializeBotManager,
  app,
  server,
  io
};
