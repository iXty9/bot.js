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
    this.log('Starting server...');
    this.startServer();
    this.log('Server started.');

    this.log('Setting up event listeners...');
    this.on('statusChanged', (status) => {
      console.log(`Status changed to: ${status}`);
    });

    this.on('messageSent', (info) => {
      this.log(`Message sent event triggered: ${info}`);
      console.log(`Message sent: ${info}`);
    });
    this.log('BotManager initialized');
  }

  getLogs() {
    this.log('Attempting to read logs from console.log...');
    try {
      const logs = fs.readFileSync('console.log', 'utf-8');
      return logs.split('\n').filter(line => line).map(line => {
        return { log: line };
      });
    } catch (error) {
      this.log(`Error occurred while reading logs: ${error.message}`);
      this.log(`Error reading logs: ${error.message}`);
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
      const response = await axios.get('http://127.0.0.1:6987');
      return response.status === 200 ? 'Running' : 'Not Running';
    } catch (error) {
      return 'Not Running';
    }
  }

  log(message) {
    const logMessage = `[BotManager] ${message}`;
    console.log(logMessage);
    logFile.write(`${new Date().toISOString()} - ${logMessage}\n`);
  }

  emitStatusChange(status) {
    this.emit('statusChanged', status);
    this.log(`Status changed to: ${status}`);
  }

  emitMessageSent(info) {
    this.emit('messageSent', info);
    this.log(`Message sent: ${info}`);
  }

  async changeStatus(newStatus) {
    try {
      await this.client.user.setStatus(newStatus);
      this.emitStatusChange(newStatus);
      return `Status changed to ${newStatus}`;
    } catch (error) {
      this.log(`Error changing status: ${error.message}`);
      throw new Error(`Failed to change status: ${error.message}`);
    }
  }

  async sendMessage(message, channelId, threadId = null) {
    try {
      const channel = await this.client.channels.fetch(channelId);
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
      
      await targetChannel.send(message);
      const info = `Message sent to ${channel.name}${threadId ? ` (thread: ${targetChannel.name})` : ''}`;
      this.emitMessageSent(info);
      return info;
    } catch (error) {
      this.log(`Error sending message: ${error.message}`);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  async handleIncomingMessage(message) {
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

        const response = await axios.post(this.webhookUrl, webhookData);
        console.log('Webhook response:', response.status, response.statusText);
        console.log('Webhook response data:', JSON.stringify(response.data, null, 2));
      } catch (error) {
        console.error('Failed to send message to webhook:', error);
        if (error.response) {
          console.error('Error response:', error.response.status, error.response.statusText);
          console.error('Error data:', JSON.stringify(error.response.data, null, 2));
        }
      }
    } else {
      console.log(`Message received: ${message.content} (from ${message.author.username} in ${message.guild.name}#${message.channel.name}${message.channel.isThread() ? ` (thread: ${message.channel.name})` : ''})`);
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
}

module.exports = BotManager;
