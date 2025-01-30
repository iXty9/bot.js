const EventEmitter = require('events');
const axios = require('axios');
const { ChannelType } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const logFile = fs.createWriteStream('console.log', { flags: 'a' });
let serverInstance = null;

class BotManager extends EventEmitter {
  constructor(client, webhookUrl) {
    super();
    this.client = client;
    this.webhookUrl = webhookUrl;
    this.logs = []; // Use array for ordered logs
    this.maxLogs = 50;
    
    // Cleanup old logs every hour
    setInterval(() => {
      const oneHourAgo = Date.now() - 3600000;
      this.logs = this.logs.filter(log => log.timestamp > oneHourAgo);
    }, 3600000);
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      commandsExecuted: 0,
      startTime: Date.now(),
      lastActivity: Date.now()
    };

    this.on('statusChanged', (status) => {
      this.log(`Status: ${status}`);
    });

    this.on('messageSent', (info) => {
      this.stats.messagesSent++;
      this.stats.lastActivity = Date.now();
      this.log(`Sent: ${info}`);
    });
  }

  getUsageStats() {
    return {
      ...this.stats,
      uptime: Math.floor((Date.now() - this.stats.startTime) / 1000), // in seconds
      lastActivityAgo: Math.floor((Date.now() - this.stats.lastActivity) / 1000) // in seconds
    };
  }

  getLogs() {
    try {
      if (!fs.existsSync('console.log')) {
        return [];
      }
      const logs = fs.readFileSync('console.log', 'utf-8');
      if (!logs.trim()) {
        return [];
      }
      return logs.split('\n')
        .filter(line => line && line.trim())
        .map(line => ({ 
          log: line,
          timestamp: new Date(line.split(' - ')[0]).getTime()
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50); // Only return last 50 logs
    } catch (error) {
      console.error(`Error reading logs: ${error.message}`);
      return [];
    }
  }

  startServer() {
    // Server functionality moved to server.js
    return 'Server management handled by server.js';
  }

  stopServer() {
    if (!serverInstance) {
      this.log('Server is not running.');
      return 'Server is not running.';
    }
    serverInstance.close(() => {
      this.log('Server stopped.');
      serverInstance = null;
    });
    return 'Server stopped.';
  }

  async checkServerStatus() {
    try {
      const response = await axios.get(`http://${process.env.API_HOST}:${process.env.API_PORT}`);
      return response.status === 200 ? 'Running' : 'Not Running';
    } catch (error) {
      return 'Not Running';
    }
  }

  log(message) {
    const timestamp = Date.now();
    const isoTime = new Date(timestamp).toISOString();
    const logMessage = `${isoTime} - [BotManager] ${message}`;
    
    // Add to in-memory logs array
    this.logs.unshift({ 
      log: logMessage,
      timestamp: timestamp
    });
    
    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    
    // Emit the log event for UI to display
    this.emit('log', logMessage);
    
    // Write to file
    logFile.write(`${logMessage}\n`);
  }

  emitStatusChange(status) {
    this.emit('statusChanged', status);
    this.log(`Status changed to: ${status}`);
    this.emit('output', `Status changed to: ${status}`);
  }

  emitMessageSent(info) {
    this.emit('messageSent', info);
    this.log(`Message sent: ${info}`);
    this.emit('output', `Message sent: ${info}`);
  }

  async changeStatus(newStatus) {
    try {
      await this.client.user.setStatus(newStatus);
      this.emitStatusChange(newStatus);
      this.stats.commandsExecuted++;
      this.stats.lastActivity = Date.now();
      return `Status changed to ${newStatus}`;
    } catch (error) {
      this.log(`Error changing status: ${error.message}`);
      throw new Error(`Failed to change status: ${error.message}`);
    }
  }

  async sendMessage(message, channelId, threadId = null) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      await this.handleRateLimit();
      if (!channel) {
        throw new Error(`Channel with ID "${channelId}" not found`);
      }
      
      let targetChannel = channel;
      if (threadId) {
        const thread = await channel.threads.fetch(threadId);
        if (!thread) {
          throw new Error(`Thread with ID "${threadId}" not found in channel "${channel.name}"`);
        }
        targetChannel = thread;
      }
      
      if (!targetChannel) {
        throw new Error('Target channel or thread not found');
      }
      
      const sentMessage = await targetChannel.send(message);
      const info = `Message sent to ${channel.name}${threadId ? ` (thread: ${targetChannel.name})` : ''}`;
      this.emitMessageSent(info);
      return sentMessage;
    } catch (error) {
      this.log(`Error sending message: ${error.message}`);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  async handleIncomingMessage(message) {
    this.stats.messagesReceived++;
    this.stats.lastActivity = Date.now();
    
    // Start typing indicator
    try {
      await message.channel.sendTyping();
    } catch (error) {
      this.log(`Error starting typing indicator: ${error.message}`);
    }
    
    if (this.webhookUrl) {
      try {
        const webhookData = {
          content: message.content,
          author: message.author.username,
          channel: message.channel.name,
          guild: message.guild ? message.guild.name : null,
          timestamp: message.createdTimestamp,
          messageId: message.id,
          authorId: message.author.id,
          channelId: message.channel.id,
          guildId: message.guild ? message.guild.id : null,
          threadId: message.channel.isThread() ? message.channel.id : null,
          threadName: message.channel.isThread() ? message.channel.name : null
        };

        console.log('Sending webhook data:', JSON.stringify(webhookData, null, 2));

        try {
          const response = await axios.post(this.webhookUrl, webhookData);
          this.log(`Webhook response: ${response.status} ${response.statusText}`);
          this.log(`Webhook data: ${JSON.stringify(response.data)}`);
        } catch (error) {
          this.log(`Webhook error: ${error.message}`);
          if (error.response) {
            this.log(`Error status: ${error.response.status}`);
            this.log(`Error data: ${JSON.stringify(error.response.data)}`);
          }
        }
      } catch (error) {
        console.error('Failed to send message to webhook:', error);
        if (error.response) {
          console.error('Error response:', error.response.status, error.response.statusText);
          console.error('Error data:', JSON.stringify(error.response.data, null, 2));
        }
        // Stop typing indicator on error
        try {
          await message.channel.sendTyping();
        } catch (typingError) {
          this.log(`Error stopping typing indicator: ${typingError.message}`);
        }
      }
    } else {
      console.log(`Message received: ${message.content} (from ${message.author.username} in ${message.guild ? message.guild.name : 'DM'}#${message.channel.name}${message.channel.isThread() ? ` (thread: ${message.channel.name})` : ''})`);
    }
  }

  async listChannels() {
    const channels = [];
    for (const guild of this.client.guilds.cache.values()) {
      const guildChannels = await guild.channels.fetch();
      for (const channel of guildChannels.values()) {
        if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildForum) {
          const channelInfo = {
            id: channel.id,
            name: channel.name,
            guildName: guild.name,
            guildId: guild.id,
            type: channel.type === ChannelType.GuildForum ? 'forum' : 'text'
          };

          if (channel.type === ChannelType.GuildForum) {
            const threads = await channel.threads.fetch();
            channelInfo.threads = threads.threads.map(thread => ({
              id: thread.id,
              name: thread.name
            }));
          }

          channels.push(channelInfo);
        }
      }
    }
    return channels;
  }

  async handleRateLimit() {
    const rateLimits = this.client.rest.globalLimit;
    if (rateLimits) {
      const delay = rateLimits.timeToReset;
      this.log(`Rate limit hit, waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = BotManager;
