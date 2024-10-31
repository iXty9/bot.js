const axios = require('axios');

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

  async sendMessage(message, channelId) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel) {
        throw new Error(`Channel with ID "${channelId}" not found`);
      }
      await channel.send(message);
      return `Message sent to ${channel.name}`;
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
          // Adding important IDs
          messageId: message.id,
          authorId: message.author.id,
          channelId: message.channel.id,
          guildId: message.guild ? message.guild.id : null
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
      console.log(`Message received: ${message.content} (from ${message.author.username} in ${message.guild.name}#${message.channel.name})`);
    }
  }

  async listChannels() {
    const textChannels = [];
    for (const guild of this.client.guilds.cache.values()) {
      const channels = await guild.channels.fetch();
      textChannels.push(...channels.filter(channel => channel.type === 0).map(channel => ({
        id: channel.id,
        name: channel.name,
        guildName: guild.name,
        guildId: guild.id
      })));
    }
    return textChannels;
  }
}

module.exports = BotManager;
