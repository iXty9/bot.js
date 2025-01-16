console.log('Loading express module...');
const express = require('express');
console.log('Loading cors module...');
const cors = require('cors');
console.log('Loading body-parser module...');
const bodyParser = require('body-parser');
console.log('Loading jsonwebtoken module...');
const jwt = require('jsonwebtoken');
const BotManager = require('../BotManager');

console.log('Initializing API server...');
const app = express();
const PORT = process.env.API_PORT || 6987;
const HOST = process.env.API_HOST || '0.0.0.0';
app.set('trust proxy', true);
const secretKey = process.env.JWT_SECRET || 'your-secret-key';

console.log('Setting up middleware...');
app.use(cors());
app.use(bodyParser.json());

// Authentication middleware
function authenticateToken(req, res, next) {
  console.log('Authenticating token...');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  if (token === process.env.DISCORD_TOKEN) {
    next();
  } else {
    console.log('Invalid token');
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

    res.json({
      status,
      currentChannel: currentChannel ? currentChannel.name : 'None',
      uptime
    });
  } catch (error) {
    console.error('Error retrieving status:', error);
    res.status(500).json({ error: 'Failed to retrieve status' });
  }
});

app.get('/api/logs', authenticateToken, (req, res) => {
  console.log('Received request for logs');
  try {
    const logs = botManager.getLogs();
    console.log('Sending logs:', logs);
    res.json({ logs });
  } catch (error) {
    console.error('Error retrieving logs:', error);
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
    console.error('Error executing command:', error);
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

// Serve static files
app.use(express.static(path.join(__dirname, '../../src/public')));

// Handle root route - must come after static file middleware
app.get('/', (req, res) => {
  console.log('Serving index.html...');
  res.sendFile(path.join(__dirname, '../../src/public/index.html'), {
    headers: {
      'Content-Type': 'text/html'
    }
  });
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

// Route to change bot status
app.post('/api/status', authenticateToken, async (req, res) => {
  try {
    const { newStatus } = req.body;
    const result = await botManager.changeStatus(newStatus);
    res.json({ message: result });
  } catch (error) {
    console.error('Error changing status:', error);
    res.status(500).json({ error: 'Failed to change status' });
  }
});

// Route to send a message
app.post('/api/send', authenticateToken, async (req, res) => {
  try {
    const { message, channelId, threadId } = req.body;
    const result = await botManager.sendMessage(message, channelId, threadId);
    res.json({ message: result });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Route to list channels
app.get('/api/channels', authenticateToken, async (req, res) => {
  try {
    const channels = await botManager.listChannels();
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list channels' });
  }
});

// Route to start/stop the server
app.post('/api/server', authenticateToken, async (req, res) => {
  try {
    const { action } = req.body;
    let result;
    if (action === 'start') {
      result = botManager.startServer();
    } else if (action === 'stop') {
      result = botManager.stopServer();
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "start" or "stop".' });
    }
    res.json({ message: result });
  } catch (error) {
    console.error('Error changing server status:', error);
    res.status(500).json({ error: 'Failed to change server status' });
  }
});

// Export the app instance so we can start it from index.js
module.exports = { 
  initializeBotManager,
  app
};
