const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { BotManager } = require('../BotManager');

const app = express();
const port = process.env.API_PORT || 3000;
const secretKey = process.env.JWT_SECRET || 'your-secret-key';

app.use(cors());
app.use(bodyParser.json());

// Authentication middleware
function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.sendStatus(403);
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
    res.status(500).json({ error: 'Failed to retrieve status' });
  }
});

app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    // Assuming logs are stored in an array
    const logs = botManager.getLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

app.post('/api/commands', authenticateToken, async (req, res) => {
  try {
    const { command, args } = req.body;
    const result = await botManager.executeCommand(command, args);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute command' });
  }
});

app.get('/api/channels', authenticateToken, async (req, res) => {
  try {
    const channels = await botManager.listChannels();
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list channels' });
  }
});

app.post('/api/channel', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.body;
    await botManager.setActiveChannel(channelId);
    res.json({ message: 'Channel set successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set active channel' });
  }
});

app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const stats = botManager.getUsageStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});
