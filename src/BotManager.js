// SECTION: Module Imports
// This section imports necessary modules and libraries needed for the functionality of the BotManager. 'events' is used for handling event-driven architecture, 'axios' for making HTTP requests, and 'discord.js', 'express', 'fs', and 'path' for respective functionalities such as Discord bot features, web server operations, and file system tasks.

import EventEmitter from 'events'; // Importing EventEmitter for handling events
import axios from 'axios'; // Importing axios for HTTP requests
import { ChannelType } from 'discord.js'; // Importing ChannelType from discord.js
import express from 'express'; // Importing express for server creation
import fs from 'fs'; // Importing fs for file system operations
import path from 'path'; // Importing path for path operations

// SECTION: Global Variables
// Defines a log file writer and a variable to keep track of the server instance. The log file is set to append mode ensuring that logs are not overwritten.

const logFile = fs.createWriteStream('console.log', { flags: 'a' }); // Log file setup
let serverInstance = null; // To track server instance status

// SECTION: BotManager Class Definition
// The BotManager class extends the EventEmitter to handle various bot-related events. It manages log retention, user statistics, and server operations. The class includes methods for recording bot activities, starting/stopping a server, and checking server status.

class BotManager extends EventEmitter {
  // FUNCTION: constructor
  // Initial setup for the BotManager instance with parameters 'client' and 'webhookUrl'. Initializes logs, setups statistics and an event listener for scheduled log cleanup.

  constructor(client, webhookUrl) {
    super();
    this.client = client;
    this.webhookUrl = webhookUrl;
    this.logs = []; // Use array for ordered logs
    this.maxLogs = 50;

    // Set up a timer for log cleanup every hour
    setInterval(() => {
      const oneHourAgo = Date.now() - 3600000;
      this.logs = this.logs.filter(log => log.timestamp > oneHourAgo); // Cleanup old logs
    }, 3600000);

    // Initialize statistics
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      commandsExecuted: 0,
      startTime: Date.now(),
      lastActivity: Date.now()
    };

    // Event listener for status changes
    this.on('statusChanged', (status) => {
      this.log(`Status: ${status}`);
    });

    // Event listener for message sent
    this.on('messageSent', (info) => {
      this.stats.messagesSent++;
      this.stats.lastActivity = Date.now();
      this.log(`Sent: ${info}`);
    });
  }

  // FUNCTION: getUsageStats
  // Retrieves and returns the usage statistics such as uptime and last activity duration in seconds.

  getUsageStats() {
    return {
      ...this.stats,
      uptime: Math.floor((Date.now() - this.stats.startTime) / 1000), // Convert milliseconds to seconds
      lastActivityAgo: Math.floor((Date.now() - this.stats.lastActivity) / 1000) // Convert to seconds
    };
  }

  // FUNCTION: getLogs
  // Fetches and returns the last 50 log entries from a log file. Handles errors during file operations.

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

  // FUNCTION: startServer
  // Initiates an Express server instance if not already running. Returns status message indicating the server state.

  startServer() {
    if (serverInstance) {
      return 'Server is already running.';
    }
    try {
      const app = express();
      serverInstance = app.listen(process.env.API_PORT || 6987, process.env.API_HOST || '0.0.0.0');
      return 'Server started successfully.';
    } catch (error) {
      return `Failed to start server: ${error.message}`;
    }
  }

  // FUNCTION: stopServer
  // Stops a running server instance if it exists and logs the server stop event. Returns a message indicating the result.

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

  // FUNCTION: checkServerStatus
  // An asynchronous function to check if the server is running by sending a GET request to the server's URL.

  async checkServerStatus() {
    try {
      const response = await axios.get(`http://${process.env.API_HOST}:${process.env.API_PORT}`);
      return response.status === 200 ? 'Running' : 'Not Running';
    } catch (error) {
      return 'Not Running';
    }
  }
}

 // SECTION: BotManager Methods
// This section covers additional methods added to the BotManager class, representing the actions the bot can perform, including logging, emitting events, changing status, sending messages, handling incoming messages, listing channels, and handling rate limits.

  // FUNCTION: log
  // Logs a message with a timestamp, storing it in-memory, writing it to a file, and emitting a log event for display purposes.

  log(message) {
    const timestamp = Date.now();
    const isoTime = new Date(timestamp).toISOString();
    const logMessage = `${isoTime} - [BotManager] ${message}`;
  
    // Add to in-memory logs array
    this.logs.unshift({
      log: logMessage,
      timestamp: timestamp
    });
  
    // VALIDATION: Log Retention
    // Ensure the logs array does not exceed the predefined maximum number of log entries.
    if (this.logs.length > this.maxLogs) {
      this.logs.pop(); // Remove oldest log
    }
  
    // UI FEEDBACK: Emit log
    // Emit the log message to update any UI components joined listening for log events.
    this.emit('log', logMessage);
  
    // Write to file
    logFile.write(`${logMessage}\n`);
  }
  
  // FUNCTION: emitStatusChange
  // Emmits a status change event, logs the change, and updates UI via the 'output' event.

  emitStatusChange(status) {
    this.emit('statusChanged', status);
    this.log(`Status changed to: ${status}`);
    this.emit('output', `Status changed to: ${status}`);
  }
  
  // FUNCTION: emitMessageSent
  // Logs a message sent event and notifies UI components by emitting the corresponding event.

  emitMessageSent(info) {
    this.emit('messageSent', info);
    this.log(`Message sent: ${info}`);
    this.emit('output', `Message sent: ${info}`);
  }
  
  // FUNCTION: changeStatus
  // Attempts to change the bot's status, logs the outcome, and manages a command execution count.

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
  
  // FUNCTION: sendMessage
  // Sends a message to a specified channel or thread, handling possible errors and logging the process.

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
      const info = `Message sent to ${channel.name}${threadId ?` (thread: ${targetChannel.name})` : ''}`;
      this.emitMessageSent(info);
      return sentMessage;
    } catch (error) {
      this.log(`Error sending message: ${error.message}`);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
  
  // FUNCTION: handleIncomingMessage
  // Processes incoming messages, manages stats, and attempts to send the message to a specified webhook if available.

  async handleIncomingMessage(message) {
    this.stats.messagesReceived++;
    this.stats.lastActivity = Date.now();
  
    // UI FEEDBACK: Typing Indicator
    // Sends a typing indicator to signal to users that the bot is processing a message.
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
      console.log(`Message received: ${message.content} (from ${message.author.username} in ${message.guild ? message.guild.name : 'DM'}#${message.channel.name}${message.channel.isThread() ? `(thread: ${message.channel.name})` : ''})`);
    }
  }
  
  // FUNCTION: listChannels
  // Fetches and returns a list of channels from all guilds the bot is part of, including text and forum types.

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
  
  // FUNCTION: handleRateLimit
  // Manages potential rate limiting by delaying further requests. Logs when rate limits are encountered.

  async handleRateLimit() {
    const rateLimits = this.client.rest.globalLimit;
    if (rateLimits) {
      const delay = rateLimits.timeToReset;
      this.log(`Rate limit hit, waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// EXPORT: BotManager
// Exports the BotManager class for use in other modules.

export default BotManager;

// SECURITY: Error Handling
// Ensure sensitive information is not logged in error messages, especially those that might be visible in logs or accessible through webhooks. 

// IMPROVEMENT SUGGESTION: Rate Limit Handling
// Consider using exponential backoff strategy for better handling of rate limits to improve efficiency and reduce possible conflicts with API limits. 
