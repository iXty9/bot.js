const axios = require('axios');
const { ChannelType } = require('discord.js');

class BotManager {
  constructor(client, webhookUrl) {
    this.client = client;
    this.webhookUrl = webhookUrl;
  }

  async changeStatus(newStatus) {
    try {
      await this.client.user.setStatus(newStatus);
      return `Status changed to ${newStatus}`;
    } catch (error) {
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
      return `Message sent to ${channel.name}${threadId ? ` (thread: ${targetChannel.name})` : ''}`;
    } catch (error) {
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
