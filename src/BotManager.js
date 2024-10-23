const axios = require('axios');

class BotManager {
  /**
   * Creates a BotManager instance.
   * @param {Object} client - The bot client instance.
   * @param {string} webhookUrl - The webhook URL to send data to.
   */
  constructor(client, webhookUrl) {
    this.client = client; // A reference to the bot's client instance.
    this.webhookUrl = webhookUrl; // The webhook URL used for sending messages externally.
  }

  /**
   * Processes an incoming message and sends it to the webhook.
   * @param {Object} message - The incoming message object.
   */
  async handleIncomingMessage(message) {
    const webhookContent = this.formatMessageForWebhook(message); // Format the incoming message for the webhook.
    await this.sendWebhook(webhookContent); // Send the formatted message to the webhook.
  }

  /**
   * Formats the incoming message object to the structure required for the webhook.
   * (Note: The detailed implementation of the format should be here)
   * @param {Object} message - The incoming message object.
   * @returns {Object} - The formatted message for the webhook.
   */
  formatMessageForWebhook(message) {
    // The formatting logic for the message goes here.
    // Example: return { content: message.content, username: message.author.username };
  }

  /**
   * Sends the provided content to the configured webhook URL.
   * @param {Object} content - The content to be sent to the webhook.
   * @returns {Promise<void>}
   */
  async sendWebhook(content) {
    try {
      const response = await axios.post(this.webhookUrl, content); // Sends a POST request to the webhook.
      console.log('Webhook sent successfully');
      console.log('Response:', response.data); // Log the response data from the webhook server.
    } catch (error) {
      console.error('Error sending webhook:', error.message); // Log any errors encountered while sending.
      
      if (error.response) {
        console.error('Response status:', error.response.status); // Log HTTP status code.
        console.error('Response data:', error.response.data); // Log the response payload if available.
      }
    }
  }

  /**
   * Sends a message to a specified channel.
   * @param {string} message - The message to send.
   * @param {string} [channelName='general'] - (optional) The name of the channel to send the message to. Defaults to 'general'.
   * @returns {Promise<string>} - The result message indicating success or failure.
   */
  async sendMessage(message, channelName = 'general') {
    // Find the channel by name (case insensitive) and ensure it's a text channel (type 0).
    const channel = this.client.channels.cache.find(ch => 
      ch.type === 0 && ch.name.toLowerCase() === channelName.toLowerCase()
    );

    if (channel) {
      await channel.send(message); // Send the message to the channel.
      return `Message sent to #${channel.name} successfully!`; // Return success message.
    } else {
      return `No channel found with name: ${channelName}`; // Return failure if the channel is not found.
    }
  }

  /**
   * Changes the bot's status (e.g., online, idle, dnd, invisible).
   * @param {string} newStatus - The desired new status of the bot.
   * @returns {Promise<string>} - A message indicating success or providing an error.
   */
  async changeStatus(newStatus) {
    const validStatuses = ['online', 'idle', 'dnd', 'invisible']; // List of valid statuses.
    
    // Check if the provided status is valid.
    if (!validStatuses.includes(newStatus)) {
      return 'Invalid status. Valid options are: online, idle, dnd, invisible'; // Return error for invalid status.
    }

    await this.client.user.setStatus(newStatus); // Change the bot's status if valid.
    return `Status changed to ${newStatus}`; // Return success message.
  }

  /**
   * Lists all text channels (type: 0) the bot is a member of.
   * @returns {Array<string>} - A sorted list of all text channel names.
   */
  listChannels() {
    // Filter all channels to get the text channels (type: 0), map to their names, and sort alphabetically.
    return this.client.channels.cache
      .filter(ch => ch.type === 0) // Keep only text-based channels.
      .map(ch => ch.name) // Extract the name of each text channel.
      .sort(); // Return the channel names sorted alphabetically.
  }
}

module.exports = BotManager;
