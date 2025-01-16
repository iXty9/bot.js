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
const PORT = 6987;
const HOST = '0.0.0.0'; // Ensures the server is accessible externally
const secretKey = process.env.JWT_SECRET || 'your-secret-key';

console.log('Setting up middleware...');
app.use(cors());
app.use(bodyParser.json());

// Authentication middleware
function authenticateToken(req, res, next) {
  console.log('Authenticating token...');
  const token = req.headers['authorization'];
  if (!token) {
    console.log('No token provided');
    return res.sendStatus(401);
  }

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      console.log('Token verification failed:', err);
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
}

// Initialize BotManager
const botManager = new BotManager(/* pass necessary parameters */);

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

const path = require('path');

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  console.log('Serving index.html...');
  res.sendFile(path.join(__dirname, '../public/index.html'));
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

console.log('Starting server...');
console.log(`Attempting to listen on http://${HOST}:${PORT}`);
console.log('Checking if the server is already running...');
console.log('Initializing server...');
app.listen(PORT, HOST, (error) => {
  console.log('Server listen callback invoked');
  if (error) {
    console.error('Failed to start server:', error);
    return;
  }
  console.log(`API server successfully running on http://${HOST}:${PORT}`);
  console.log('Server is now listening for incoming connections...');
  if (error) {
    console.error('Failed to start server:', error);
    return;
  }
  console.log(`API server successfully running on http://${HOST}:${PORT}`);
  console.log('Server is now listening for incoming connections...');
  if (error) {
    console.error('Failed to start server:', error);
    return;
  }
  console.log(`API server successfully running on http://${HOST}:${PORT}`);
  console.log('Server is now listening for incoming connections...');
  console.log('Server is now listening for incoming connections...');
});
