const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const http = require('http');
const BotManager = require('../BotManager');
const app = express();
const PORT = process.env.API_PORT || 6987;
const HOST = process.env.API_HOST || '0.0.0.0';
app.set('trust proxy', true);
const secretKey = process.env.JWT_SECRET || 'your-secret-key';

app.use(cors());
app.use(bodyParser.json());

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    // Check for token in query params
    const queryToken = req.query.token;
    if (queryToken && queryToken === process.env.DISCORD_TOKEN) {
      next();
      return;
    }
    return res.status(401).json({ error: 'No token provided' });
  }

  if (token === process.env.DISCORD_TOKEN) {
    next();
  } else {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Initialize BotManager with the Discord client
let botManager = null;

function initializeBotManager(client) {
  if (!botManager) {
    botManager = new BotManager(client);
  }
  return botManager;
}

// Export for use in index.js
module.exports = { initializeBotManager, app };

// API routes
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
    const { command, args } = req.body;
    const result = await botManager.executeCommand(command, args);
    res.json({ result });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: 'Failed to execute command' });
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

const path = require('path');

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
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Export the server instance so we can start it from index.js
module.exports = { 
  initializeBotManager,
  app,
  server,
  io
};
