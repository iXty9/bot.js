const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
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
    console.error('Error retrieving status:', error);
    res.status(500).json({ error: 'Failed to retrieve status' });
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

// Serve webpack bundle and static files
app.use(express.static(path.join(__dirname, '../../src/public')));

// Handle root route and all non-API routes
app.get(/^(?!\/api\/).+/, (req, res) => {
  console.log('Serving index.html...');
  res.sendFile(path.join(__dirname, '../../src/public/index.html'));
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
