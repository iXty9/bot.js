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

  constructor(client, webhookUrl, dmWebhookUrl = null) {
    super();
    this.client = client;
    this.webhookUrl = webhookUrl;
    
    // Initialize logs array first before using log method
    this.logs = [];
    
    // Ensure DM webhook URL is properly set with more explicit logging
    if (dmWebhookUrl && dmWebhookUrl.trim() !== '') {
      this.dmWebhookUrl = dmWebhookUrl;
      console.log(`DM webhook URL set from constructor parameter`);
    } else if (process.env.DM_WEBHOOK_URL && process.env.DM_WEBHOOK_URL.trim() !== '') {
      this.dmWebhookUrl = process.env.DM_WEBHOOK_URL;
      console.log(`DM webhook URL set from environment variable`);
    } else {
      this.dmWebhookUrl = webhookUrl;
      console.log(`DM webhook URL falling back to regular webhook URL`);
    }
    
    // Log webhook configuration with more details
    console.log(`Regular webhook URL: ${this.webhookUrl ? this.webhookUrl.substring(0, 30) + '...' : 'Not set'}`);
    console.log(`DM webhook URL: ${this.dmWebhookUrl ? this.dmWebhookUrl.substring(0, 30) + '...' : 'Not set'}`);
    console.log(`Are webhook URLs different: ${this.webhookUrl !== this.dmWebhookUrl}`);
    
    this.log(`Regular webhook URL configured: ${this.webhookUrl ? 'Yes' : 'No'}`);
    this.log(`DM webhook URL configured: ${this.dmWebhookUrl ? 'Yes' : 'No'}`);
    this.log(`Using separate DM webhook: ${this.webhookUrl !== this.dmWebhookUrl ? 'Yes' : 'No'}`);
    this.maxLogs = 50;
    this.currentChannelId = null;
    this.currentThreadId = null;
    
    // Set up Discord event logging
    this.setupDiscordEventLogging();

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
    
    // Event listener for channel changes
    this.on('channelChanged', (channelInfo) => {
      // Reset thread when channel changes
      this.currentThreadId = null;
      this.log(`Channel changed to: ${channelInfo.name}`);
    });
    
    // Event listener for thread changes
    this.on('threadChanged', (threadInfo) => {
      this.log(`Thread changed to: ${threadInfo.name}`);
    });
  }
  
  // Set up comprehensive Discord client event logging
  setupDiscordEventLogging() {
    // Log when the bot receives a direct message
    this.client.on('messageCreate', message => {
      // Only log DMs to avoid cluttering logs with all messages
      // Check both the guild property and the channel_type
      const isDM = !message.guild || message.channel.type === 1 || message.channel.type === 'DM';
      if (isDM) {
        console.log(`[DISCORD EVENT] DM received from ${message.author.username} (${message.author.id})`);
        console.log(`[DISCORD EVENT] DM content: ${message.content.substring(0, 100)}`);
        console.log(`[DISCORD EVENT] DM channel type: ${message.channel.type}`);
        this.log(`[DISCORD EVENT] DM received from ${message.author.username}`);
        
        // Attempt to forward the DM immediately to the webhook
        this.handleIncomingMessage(message).catch(err => {
          console.error(`[DISCORD EVENT] Failed to handle DM: ${err.message}`);
          this.log(`[DISCORD EVENT] Failed to handle DM: ${err.message}`);
        });
      }
    });

    // Log when the bot connects/disconnects
    this.client.on('ready', () => {
      console.log(`[DISCORD EVENT] Bot connected as ${this.client.user.tag}`);
      this.log(`[DISCORD EVENT] Bot connected as ${this.client.user.tag}`);
    });

    this.client.on('disconnect', (event) => {
      console.log(`[DISCORD EVENT] Bot disconnected with code ${event?.code || 'unknown'}`);
      this.log(`[DISCORD EVENT] Bot disconnected`);
    });

    this.client.on('error', error => {
      console.error(`[DISCORD EVENT] Client error: ${error.message}`);
      this.log(`[DISCORD EVENT] Client error: ${error.message}`);
    });

    // Log channel-related events
    this.client.on('channelCreate', channel => {
      if (channel.type === 'DM' || channel.type === 1) {
        console.log(`[DISCORD EVENT] DM channel created with ${channel.recipient?.username || 'unknown user'}`);
        this.log(`[DISCORD EVENT] DM channel created`);
      }
    });

    // Log when the bot is added to a direct message
    this.client.on('channelUpdate', (oldChannel, newChannel) => {
      if (newChannel.type === 'DM' || newChannel.type === 1) {
        console.log(`[DISCORD EVENT] DM channel updated with ${newChannel.recipient?.username || 'unknown user'}`);
        this.log(`[DISCORD EVENT] DM channel updated`);
      }
    });

    // Debug raw Discord events to see everything
    if (process.env.DEBUG === 'true') {
      this.client.on('raw', packet => {
        // Only log DM-related packets
        if (packet.t === 'MESSAGE_CREATE' && packet.d) {
          // Check if it's a DM by looking at channel_type === 1
          const isDM = packet.d.channel_type === 1 || !packet.d.guild_id;
          if (isDM) {
            console.log('[DISCORD RAW EVENT] DM packet received:');
            console.log(JSON.stringify(packet.d, null, 2));
            
            // Try to manually forward this DM to the webhook
            if (this.dmWebhookUrl) {
              this.forwardRawDMToWebhook(packet.d).catch(err => {
                console.error(`Failed to forward raw DM to webhook: ${err.message}`);
              });
            }
          }
        }
      });
    }
  }
  
  /**
   * Forward a raw DM packet directly to the webhook
   * @param {Object} dmData - The raw DM data from Discord
   * @returns {Promise<void>}
   */
  async forwardRawDMToWebhook(dmData) {
    if (!this.dmWebhookUrl) {
      console.error('No DM webhook URL configured for raw forwarding');
      return;
    }
    
    try {
      console.log(`Forwarding raw DM directly to webhook: ${this.dmWebhookUrl.substring(0, 30)}...`);
      
      // Create a simplified payload from the raw data
      const webhookData = {
        content: dmData.content,
        author: dmData.author.username,
        authorId: dmData.author.id,
        channelId: dmData.channel_id,
        messageId: dmData.id,
        timestamp: new Date(dmData.timestamp).getTime(),
        timestampISO: dmData.timestamp,
        
        // Add explicit DM flags
        isDM: true,
        messageType: 'directMessage',
        directMessage: true,
        dm: true,
        type: 'dm',
        source: 'direct_message',
        
        // Include the raw channel type for debugging
        channelType: dmData.channel_type,
        
        // Include the full raw data for complete information
        rawData: dmData,
        
        // Flag that this came from raw event handler
        fromRawEvent: true
      };
      
      // Send to webhook
      const response = await axios.post(this.dmWebhookUrl, webhookData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DiscordBot/1.0'
        }
      });
      
      console.log(`Raw DM webhook response: ${response.status} ${response.statusText}`);
      this.log(`Raw DM forwarded to webhook successfully`);
      
    } catch (error) {
      console.error(`Error forwarding raw DM to webhook: ${error.message}`);
      this.log(`Error forwarding raw DM to webhook: ${error.message}`);
      
      if (error.response) {
        console.error(`Error status: ${error.response.status}`);
        console.error(`Error data:`, error.response.data);
      }
    }
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
      // First try to return in-memory logs
      if (this.logs && this.logs.length > 0) {
        return this.logs;
      }
      
      // If no in-memory logs, try to read from file
      if (!fs.existsSync('console.log')) {
        this.log('No log file found. Creating new log file.');
        fs.writeFileSync('console.log', `${new Date().toISOString()} - [BotManager] Log file created\n`, 'utf-8');
        return [{
          log: `${new Date().toISOString()} - [BotManager] Log file created`,
          timestamp: Date.now()
        }];
      }
      
      const logContent = fs.readFileSync('console.log', 'utf-8');
      if (!logContent.trim()) {
        return [];
      }
      
      // Convert file logs to the same format as in-memory logs
      return logContent.split('\n')
        .filter(line => line && line.trim())
        .map(line => ({
          log: line,
          timestamp: new Date(line.split(' - ')[0]).getTime()
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50); // Only return last 50 logs
    } catch (error) {
      this.log(`Error reading logs: ${error.message}`);
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
      this.logs = this.logs.slice(0, this.maxLogs); // Keep only the most recent logs
    }
  
    // UI FEEDBACK: Emit log
    // Emit the log message to update any UI components joined listening for log events.
    this.emit('log', logMessage);
  
    // Write to file
    logFile.write(`${logMessage}\n`);
  }
  
  // FUNCTION: emitStatusChange
  // Emmits a status change event, logs the change, and updates UI via the 'output' event.

  refreshLogs() {
    try {
      if (process.env.DEBUG === 'true') {
        console.debug('Refreshing logs from file...');
      }
      
      // Clear in-memory logs
      this.logs = [];
      
      // Read logs from file if it exists
      if (fs.existsSync('console.log')) {
        const logContent = fs.readFileSync('console.log', 'utf-8');
        if (logContent.trim()) {
          // Parse file logs into the same format as in-memory logs
          this.logs = logContent.split('\n')
            .filter(line => line.trim())
            .map(line => {
              try {
                const parts = line.split(' - ');
                const timestamp = parts.length > 0 ? new Date(parts[0]).getTime() : Date.now();
                return {
                  log: line,
                  timestamp: isNaN(timestamp) ? Date.now() : timestamp
                };
              } catch (e) {
                return {
                  log: line,
                  timestamp: Date.now()
                };
              }
            })
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, this.maxLogs);
        }
      }
      
      if (process.env.DEBUG === 'true') {
        console.debug(`Refreshed ${this.logs.length} logs`);
      }
      
      // Add a log entry about the refresh
      this.log('Logs refreshed from file');
      
      return this.logs;
    } catch (error) {
      this.log(`Error refreshing logs: ${error.message}`);
      if (process.env.DEBUG === 'true') {
        console.error('Error refreshing logs:', error);
      }
      return [];
    }
  }

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
      // Use current channel/thread if not specified
      const targetChannelId = channelId || this.currentChannelId;
      const targetThreadId = threadId || this.currentThreadId;
      
      if (!targetChannelId) {
        throw new Error('No channel specified and no current channel set');
      }
      
      this.log(`Sending message to channel ${targetChannelId}${targetThreadId ? ` (thread: ${targetThreadId})` : ''}`);
      
      if (!message || message.trim() === '') {
        throw new Error('Message content cannot be empty');
      }
      
      // Handle rate limits
      await this.handleRateLimit();
      
      // Fetch the channel
      const channel = await this.client.channels.fetch(targetChannelId);
      if (!channel) {
        throw new Error(`Channel with ID "${targetChannelId}" not found`);
      }
      
      if (process.env.DEBUG === 'true') {
        console.debug(`Found channel: ${channel.name} (type: ${channel.type})`);
      }
      
      // Determine target (channel or thread)
      let targetChannel = channel;
      if (targetThreadId) {
        if (process.env.DEBUG === 'true') {
          console.debug(`Looking for thread: ${targetThreadId}`);
        }
        const thread = await channel.threads.fetch(targetThreadId);
        if (!thread) {
          throw new Error(`Thread with ID "${targetThreadId}" not found in channel "${channel.name}"`);
        }
        targetChannel = thread;
        if (process.env.DEBUG === 'true') {
          console.debug(`Found thread: ${thread.name}`);
        }
      }
      
      // Send the message
      if (process.env.DEBUG === 'true') {
        console.debug(`Sending message to ${targetChannel.name}`);
      }
      const sentMessage = await targetChannel.send(message);
      
      // Log success
      const info = `Message sent to ${channel.name}${targetThreadId ? ` (thread: ${targetChannel.name})` : ''}`;
      this.emitMessageSent(info);
      
      // Update current channel and thread if not already set
      if (!this.currentChannelId) {
        this.currentChannelId = targetChannelId;
        this.log(`Set current channel to: ${channel.name}`);
      }
      
      if (targetThreadId && !this.currentThreadId) {
        this.currentThreadId = targetThreadId;
        this.log(`Set current thread to: ${targetChannel.name}`);
      }
      
      return sentMessage;
    } catch (error) {
      this.log(`Error sending message: ${error.message}`);
      this.log(`Full error: ${error.message}`);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
  
  // FUNCTION: handleIncomingMessage
  // Processes incoming messages, manages stats, and attempts to send the message to a specified webhook if available.

  async handleIncomingMessage(message) {
    // Update stats
    this.stats.messagesReceived++;
    this.stats.lastActivity = Date.now();
  
    // Determine if this is a DM or a guild message
    // Check both the guild property and the channel_type from raw data if available
    const isDM = !message.guild || message.channel.type === 1 || message.channel.type === 'DM';
    
    // Log basic message info with more details for debugging
    this.log(`Message received from ${message.author.username} (${message.author.id})`);
    this.log(`Message channel type: ${message.channel.type}`);
    this.log(`Message content: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`);
    
    // Send typing indicator
    try {
      await message.channel.sendTyping();
    } catch (error) {
      this.log(`Error with typing indicator: ${error.message}`);
    }
    
    // Special handling for DMs with more detailed logging
    if (isDM) {
      this.log(`DM detected from ${message.author.username} (${message.author.id})`);
      this.log(`DM channel ID: ${message.channel.id}`);
      
      // Add detailed message object inspection for DMs
      console.log('=== DETAILED DM MESSAGE INSPECTION ===');
      console.log(`Author: ${message.author.username} (${message.author.id})`);
      console.log(`Channel ID: ${message.channel.id}`);
      console.log(`Channel Type: ${message.channel.type}`);
      console.log(`Message ID: ${message.id}`);
      console.log(`Content: ${message.content}`);
      console.log(`Timestamp: ${message.createdAt}`);
      console.log(`Available methods on channel:`, Object.getOwnPropertyNames(Object.getPrototypeOf(message.channel)));
      console.log('=====================================');
      
      // Check if DM webhook URL is set in environment
      if (!process.env.DM_WEBHOOK_URL) {
        this.log("WARNING: DM_WEBHOOK_URL is not set in environment variables!");
      }
      
      // Make sure we have a DM webhook URL
      if (!this.dmWebhookUrl) {
        this.log("ERROR: No DM webhook URL configured!");
        // Fallback to regular webhook if DM webhook is not set
        this.dmWebhookUrl = this.webhookUrl;
        this.log(`Falling back to regular webhook URL for DMs: ${this.dmWebhookUrl ? 'URL set' : 'No URL available'}`);
      }
    }
    
    // Select the appropriate webhook URL
    const webhookUrl = isDM ? this.dmWebhookUrl : this.webhookUrl;
    
    if (!webhookUrl) {
      this.log(`No webhook URL configured for ${isDM ? 'DM' : 'channel'} messages`);
      return;
    }
    
    try {
      // Create webhook data with more explicit DM flags and include raw channel_type
      const webhookData = {
        content: message.content,
        author: message.author.username,
        channel: isDM ? 'DM' : message.channel.name,
        guild: message.guild ? message.guild.name : 'Direct Message',
        timestamp: message.createdTimestamp,
        messageId: message.id,
        authorId: message.author.id,
        channelId: message.channel.id,
        guildId: message.guild ? message.guild.id : null,
        threadId: message.channel.isThread() ? message.channel.id : null,
        threadName: message.channel.isThread() ? message.channel.name : null,
        
        // Add explicit DM flags to ensure proper handling
        isDM: isDM,
        messageType: isDM ? 'directMessage' : 'channelMessage',
        directMessage: isDM,
        dm: isDM,
        type: isDM ? 'dm' : 'channel',
        source: isDM ? 'direct_message' : 'channel_message',
        
        // Add additional fields that might help with webhook processing
        isDirectMessage: isDM,
        messageSource: isDM ? 'dm' : 'guild',
        fromUser: message.author.username,
        fromUserId: message.author.id,
        
        // Add raw channel type information from Discord
        channelType: message.channel.type,
        rawChannelType: message.channel.type === 1 ? 'DM (1)' : `${message.channel.type}`,
        
        // Add timestamp in ISO format for better readability
        timestampISO: new Date(message.createdTimestamp).toISOString()
      };
      
      // Log webhook attempt with more details
      this.log(`Sending ${isDM ? 'DM' : 'channel'} message to webhook: ${webhookUrl.substring(0, 30)}...`);
      
      if (isDM) {
        // For DMs, log more details to help troubleshoot
        console.log(`Sending DM to webhook: ${webhookUrl.substring(0, 30)}...`);
        console.log(`DM webhook data:`, JSON.stringify(webhookData, null, 2));
      }
      
      // Send to webhook with timeout and retry
      const response = await axios.post(webhookUrl, webhookData, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DiscordBot/1.0'
        }
      });
      
      this.log(`Webhook response: ${response.status} ${response.statusText}`);
      
      if (isDM) {
        console.log(`DM webhook response: ${response.status} ${response.statusText}`);
      }
      
    } catch (error) {
      this.log(`Webhook error: ${error.message}`);
      
      if (isDM) {
        console.error(`DM webhook error: ${error.message}`);
      }
      
      if (error.response) {
        this.log(`Error status: ${error.response.status}`);
        this.log(`Error data: ${JSON.stringify(error.response.data || {})}`);
        
        if (isDM) {
          console.error(`DM webhook error status: ${error.response.status}`);
          console.error(`DM webhook error data:`, error.response.data);
        }
      } else if (error.request) {
        this.log(`No response received from webhook`);
        
        if (isDM) {
          console.error(`No response received from DM webhook`);
        }
        
        // Try one more time with a different content type
        try {
          if (isDM) {
            this.log(`Retrying DM webhook with different content type...`);
            const retryResponse = await axios.post(webhookUrl, webhookData, {
              timeout: 10000,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'DiscordBot/1.0'
              }
            });
            this.log(`Retry webhook response: ${retryResponse.status} ${retryResponse.statusText}`);
          }
        } catch (retryError) {
          this.log(`Retry webhook error: ${retryError.message}`);
        }
      }
    }
  }
  
  // FUNCTION: listChannels
  // Fetches and returns a list of channels from all guilds the bot is part of, including text and forum types.

  async listChannels() {
    try {
      // Use debug log instead of console.log
      if (process.env.DEBUG === 'true') {
        console.debug('Listing channels from all guilds...');
      }
      const channels = [];
      
      // Check if client is ready
      if (!this.client || !this.client.isReady()) {
        this.log('Discord client is not ready');
        return [];
      }
      
      // Get guilds
      const guilds = this.client.guilds.cache;
      if (process.env.DEBUG === 'true') {
        console.debug(`Found ${guilds.size} guilds`);
      }
      
      for (const guild of guilds.values()) {
        if (process.env.DEBUG === 'true') {
          console.debug(`Processing guild: ${guild.name} (${guild.id})`);
        }
        
        try {
          // Fetch all channels in the guild
          const guildChannels = await guild.channels.fetch();
          if (process.env.DEBUG === 'true') {
            console.debug(`Found ${guildChannels.size} channels in guild ${guild.name}`);
          }
          
          for (const channel of guildChannels.values()) {
            // Check channel type - support both enum and numeric values
            const isTextChannel = 
              channel.type === ChannelType.GuildText || 
              channel.type === 0;
            
            const isForumChannel = 
              channel.type === ChannelType.GuildForum || 
              channel.type === 15;
            
            if (isTextChannel || isForumChannel) {
              if (process.env.DEBUG === 'true') {
                console.debug(`Processing channel: ${channel.name} (${channel.id}, type: ${channel.type})`);
              }
              
              const channelInfo = {
                id: channel.id,
                name: channel.name,
                guildName: guild.name,
                guildId: guild.id,
                type: isForumChannel ? 'forum' : 'text'
              };
              
              // For forum channels, fetch threads
              if (isForumChannel) {
                try {
                  const threads = await channel.threads.fetch();
                  if (process.env.DEBUG === 'true') {
                    console.debug(`Found ${threads.threads.size} threads in forum ${channel.name}`);
                  }
                  
                  channelInfo.threads = Array.from(threads.threads.values()).map(thread => ({
                    id: thread.id,
                    name: thread.name
                  }));
                } catch (threadError) {
                  this.log(`Error fetching threads for channel ${channel.name}: ${threadError.message}`);
                  channelInfo.threads = [];
                }
              }
              
              // Add to our list
              channels.push(channelInfo);
            }
          }
        } catch (guildError) {
          this.log(`Error processing guild ${guild.name}: ${guildError.message}`);
        }
      }
      
      if (process.env.DEBUG === 'true') {
        console.debug(`Returning ${channels.length} channels total`);
      }
      return channels;
    } catch (error) {
      this.log(`Error in listChannels: ${error.message}`);
      return [];
    }
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

  async restart() {
    try {
      this.log('Attempting to restart bot...');
      
      // Destroy the current client connection
      await this.client.destroy();
      
      // Wait a moment to ensure clean disconnect
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Login again with the token
      await this.client.login(process.env.DISCORD_TOKEN);
      
      this.log('Bot successfully restarted');
      return 'Bot successfully restarted';
    } catch (error) {
      const errorMsg = `Failed to restart bot: ${error.message}`;
      this.log(errorMsg);
      throw new Error(errorMsg);
    }
  }
  
  // Debug function to check webhook URLs
  getWebhookInfo() {
    return {
      regularWebhook: {
        url: this.webhookUrl,
        isSet: !!this.webhookUrl,
        length: this.webhookUrl ? this.webhookUrl.length : 0
      },
      dmWebhook: {
        url: this.dmWebhookUrl,
        isSet: !!this.dmWebhookUrl,
        length: this.dmWebhookUrl ? this.dmWebhookUrl.length : 0,
        fromEnv: this.dmWebhookUrl === process.env.DM_WEBHOOK_URL
      },
      environment: {
        regularWebhookSet: !!process.env.WEBHOOK_URL,
        dmWebhookSet: !!process.env.DM_WEBHOOK_URL,
        areEnvUrlsDifferent: process.env.WEBHOOK_URL !== process.env.DM_WEBHOOK_URL
      },
      areInstanceUrlsDifferent: this.webhookUrl !== this.dmWebhookUrl
    };
  }
  
  /**
   * Checks if a webhook URL is online and responding
   * @param {string} url - The webhook URL to check
   * @param {string} name - Name of the webhook for logging
   * @returns {Promise<boolean>} True if webhook is online, false otherwise
   */
  async checkWebhookStatus(url, name) {
    if (!url) {
      this.log(`${name} webhook URL is not set`);
      return false;
    }
    
    try {
      // Try to send a minimal POST request to verify the webhook is actually working
      const response = await axios.post(url, 
        { type: 'ping', message: 'Webhook status check' },
        { 
          timeout: 3000,
          validateStatus: status => status >= 200 && status < 300 // Only accept 2xx status codes as success
        }
      );
      
      this.log(`${name} webhook is online and accepting requests (status: ${response.status})`);
      return true;
    } catch (error) {
      // Log detailed error information
      if (error.response) {
        this.log(`${name} webhook returned error status: ${error.response.status}`);
        if (error.response.data) {
          this.log(`${name} webhook error details: ${JSON.stringify(error.response.data)}`);
        }
      } else if (error.request) {
        this.log(`${name} webhook is offline (no response received): ${error.message}`);
      } else {
        this.log(`${name} webhook check error: ${error.message}`);
      }
      
      return false;
    }
  }
  
  /**
   * Checks both webhooks and returns their status
   * @returns {Promise<{regular: boolean, dm: boolean}>} Status of both webhooks
   */
  async checkWebhooks() {
    // First try the main check method
    let regularStatus = await this.checkWebhookStatus(this.webhookUrl, 'Regular');
    let dmStatus = await this.checkWebhookStatus(this.dmWebhookUrl, 'DM');
    
    // If either webhook check failed, try the fallback method
    if (!regularStatus) {
      this.log('Primary check for Regular webhook failed, trying fallback...');
      regularStatus = await this.fallbackWebhookCheck(this.webhookUrl, 'Regular');
    }
    
    if (!dmStatus) {
      this.log('Primary check for DM webhook failed, trying fallback...');
      dmStatus = await this.fallbackWebhookCheck(this.dmWebhookUrl, 'DM');
    }
    
    // Log the final status
    this.log(`Final webhook status - Regular: ${regularStatus ? 'ONLINE' : 'OFFLINE'}, DM: ${dmStatus ? 'ONLINE' : 'OFFLINE'}`);
    
    return {
      regular: regularStatus,
      dm: dmStatus
    };
  }
  
  /**
   * Fallback method to check webhook status using a connection test
   * @param {string} url - The webhook URL to check
   * @param {string} name - Name of the webhook for logging
   * @returns {Promise<boolean>} True if webhook is online, false otherwise
   */
  async fallbackWebhookCheck(url, name) {
    if (!url) {
      return false;
    }
    
    try {
      this.log(`Trying TCP connection check for ${name} webhook...`);
      
      // Parse the URL to get hostname and port
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const port = urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80);
      
      // Use a simple HEAD request with short timeout to check if server is reachable
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      try {
        await axios.head(`${urlObj.protocol}//${hostname}:${port}`, {
          signal: controller.signal,
          timeout: 2000
        });
        clearTimeout(timeoutId);
        
        this.log(`${name} webhook server is reachable, but webhook may not be accepting requests`);
        return false; // Server is up but webhook didn't accept our POST request
      } catch (headError) {
        clearTimeout(timeoutId);
        if (headError.code === 'ECONNREFUSED' || headError.code === 'ETIMEDOUT') {
          this.log(`${name} webhook server is not reachable: ${headError.message}`);
          return false;
        }
        
        // If we get any response (even an error), the server is at least online
        if (headError.response) {
          this.log(`${name} webhook server is reachable, but webhook may not be accepting requests`);
          return false;
        }
        
        this.log(`${name} webhook connection check failed: ${headError.message}`);
        return false;
      }
    } catch (error) {
      this.log(`${name} webhook fallback check failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Tests the DM webhook by sending a test message
   * @returns {Promise<boolean>} True if test was successful
   */
  async testDMWebhook() {
    try {
      if (!this.dmWebhookUrl) {
        this.log("ERROR: No DM webhook URL configured for testing");
        return false;
      }
      
      this.log(`Testing DM webhook: ${this.dmWebhookUrl.substring(0, 30)}...`);
      console.log(`Testing DM webhook: ${this.dmWebhookUrl.substring(0, 30)}...`);
      
      // Create a test message that mimics the structure of a real DM
      const testData = {
        content: "This is a test message from the Discord bot",
        author: this.client.user.username,
        channel: "DM",
        guild: "Direct Message",
        timestamp: Date.now(),
        messageId: "test-" + Date.now(),
        authorId: this.client.user.id,
        channelId: "test-channel-" + Date.now(),
        
        // Add explicit DM flags
        isDM: true,
        messageType: "directMessage",
        directMessage: true,
        dm: true,
        type: "dm",
        source: "direct_message",
        isTest: true,
        
        // Add channel type information from the raw data
        channelType: 1,
        rawChannelType: "DM (1)",
        
        // Add timestamp in ISO format
        timestampISO: new Date().toISOString(),
        
        // Add a sample of what the raw data would look like
        rawSample: {
          channel_type: 1,
          author: {
            username: this.client.user.username,
            id: this.client.user.id
          }
        }
      };
      
      // Log the full test data for debugging
      console.log("DM webhook test data:", JSON.stringify(testData, null, 2));
      
      const response = await axios.post(this.dmWebhookUrl, testData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DiscordBot/1.0'
        }
      });
      
      this.log(`DM webhook test response: ${response.status} ${response.statusText}`);
      console.log(`DM webhook test response: ${response.status} ${response.statusText}`);
      
      // If successful, also try sending a raw-format message
      if (response.status >= 200 && response.status < 300) {
        // Try a second test with the exact format from the raw event
        const rawFormatTest = {
          type: 0,
          content: "This is a raw format test message",
          channel_type: 1,
          channel_id: "test-channel-" + Date.now(),
          author: {
            username: this.client.user.username,
            id: this.client.user.id
          },
          timestamp: new Date().toISOString(),
          id: "test-" + Date.now()
        };
        
        console.log("Testing with raw format:", JSON.stringify(rawFormatTest, null, 2));
        
        try {
          const rawResponse = await axios.post(this.dmWebhookUrl, rawFormatTest, {
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'DiscordBot/1.0'
            }
          });
          
          console.log(`Raw format test response: ${rawResponse.status} ${rawResponse.statusText}`);
          this.log(`Raw format test successful`);
        } catch (rawError) {
          console.error(`Raw format test failed: ${rawError.message}`);
          this.log(`Raw format test failed: ${rawError.message}`);
          // Continue anyway since the main test passed
        }
      }
      
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      this.log(`DM webhook test error: ${error.message}`);
      console.error(`DM webhook test error: ${error.message}`);
      
      if (error.response) {
        this.log(`Error status: ${error.response.status}`);
        this.log(`Error data: ${JSON.stringify(error.response.data || {})}`);
        console.error(`Error status: ${error.response.status}`);
        console.error(`Error data:`, error.response.data);
      }
      
      return false;
    }
  }

  /**
   * Sets the active channel for the bot
   * @param {string} channelId - The ID of the channel to set as active
   * @returns {Promise<string>} Success message
   */
  async setActiveChannel(channelId) {
    try {
      if (!channelId) {
        throw new Error('Channel ID is required');
      }
      
      if (process.env.DEBUG === 'true') {
        console.debug(`Attempting to set active channel: ${channelId}`);
      }
      
      // Store the channel ID immediately
      this.currentChannelId = channelId;
      
      // Try to fetch the channel details, but don't fail if we can't
      let channelInfo = `Channel ID: ${channelId}`;
      try {
        const channel = await this.client.channels.fetch(channelId);
        if (channel) {
          channelInfo = `${channel.name} (${channel.type}) in ${channel.guild ? channel.guild.name : 'Unknown Guild'}`;
          
          // Emit an event for the change
          this.emit('channelChanged', {
            id: channelId,
            name: channel.name,
            type: channel.type,
            guildId: channel.guild ? channel.guild.id : null,
            guildName: channel.guild ? channel.guild.name : null
          });
        }
      } catch (fetchError) {
        this.log(`Could not fetch channel details: ${fetchError.message}`);
        // Continue anyway since we already set the ID
      }
      
      // Log the change
      this.log(`Active channel set to: ${channelInfo}`);
      
      return `Active channel set to: ${channelInfo}`;
    } catch (error) {
      this.log(`Error setting active channel: ${error.message}`);
      if (process.env.DEBUG === 'true') {
        this.log(`Full error: ${error.message}`);
      }
      throw new Error(`Failed to set active channel: ${error.message}`);
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
