const axios = require('axios');

class BotManager {
  constructor(client, webhookUrl) {
    this.client = client;
    this.webhookUrl = webhookUrl;
  }

  async handleIncomingMessage(message) {
    const webhookContent = this.formatMessageForWebhook(message);
    await this.sendWebhook(webhookContent);
  }

  formatMessageForWebhook(message) {
    // ... (keep the existing formatting logic)
  }

  async sendWebhook(content) {
    try {
      const response = await axios.post(this.webhookUrl, content);
      console.log('Webhook sent successfully');
      console.log('Response:', response.data);
    } catch (error) {
      console.error('Error sending webhook:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }
  }

  async sendMessage(message, channelName = 'general') {
    const channel = this.client.channels.cache.find(ch => 
      ch.type === 0 && ch.name.toLowerCase() === channelName.toLowerCase()
    );

    if (channel) {
      await channel.send(message);
      return `Message sent to #${channel.name} successfully!`;
    } else {
      return `No channel found with name: ${channelName}`;
    }
  }

  async changeStatus(newStatus) {
    const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
    if (!validStatuses.includes(newStatus)) {
      return 'Invalid status. Valid options are: online, idle, dnd, invisible';
    }

    await this.client.user.setStatus(newStatus);
    return `Status changed to ${newStatus}`;
  }

  listChannels() {
    return this.client.channels.cache
      .filter(ch => ch.type === 0)
      .map(ch => ch.name)
      .sort();
  }
}

module.exports = BotManager;