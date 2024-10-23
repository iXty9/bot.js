const axios = require('axios');
const { addWebhookLog } = require('./consoleManager');

async function handleMessage(message) {
  if (message.author.bot) return;
  
  const webhookContent = {
    messageId: message.id,
    content: message.content,
    author: {
      id: message.author.id,
      username: message.author.username,
      discriminator: message.author.discriminator,
      avatar: message.author.avatar,
      bot: message.author.bot,
      system: message.author.system,
      avatarURL: message.author.displayAvatarURL()
    },
    channel: {
      id: message.channel.id,
      name: message.channel.name,
      type: message.channel.type
    },
    guild: message.guild ? {
      id: message.guild.id,
      name: message.guild.name,
      icon: message.guild.icon
    } : null,
    createdTimestamp: message.createdTimestamp,
    editedTimestamp: message.editedTimestamp,
    tts: message.tts,
    mentionEveryone: message.mentionEveryone,
    mentions: {
      users: Array.from(message.mentions.users.values()).map(user => ({
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar
      })),
      roles: Array.from(message.mentions.roles.values()).map(role => ({
        id: role.id,
        name: role.name,
        color: role.color
      })),
      channels: Array.from(message.mentions.channels.values()).map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type
      }))
    },
    attachments: Array.from(message.attachments.values()).map(attachment => ({
      id: attachment.id,
      name: attachment.name,
      size: attachment.size,
      url: attachment.url,
      proxyURL: attachment.proxyURL,
      height: attachment.height,
      width: attachment.width,
      contentType: attachment.contentType
    })),
    embeds: message.embeds.map(embed => ({
      title: embed.title,
      type: embed.type,
      description: embed.description,
      url: embed.url,
      timestamp: embed.timestamp,
      color: embed.color,
      footer: embed.footer,
      image: embed.image,
      thumbnail: embed.thumbnail,
      video: embed.video,
      provider: embed.provider,
      author: embed.author,
      fields: embed.fields
    }))
  };

  try {
    const response = await axios.post(process.env.WEBHOOK_URL, webhookContent);
    addWebhookLog('Sent content: ' + JSON.stringify(webhookContent, null, 2));
    addWebhookLog('Received response: ' + JSON.stringify(response.data, null, 2));
  } catch (error) {
    addWebhookLog('Error sending message to webhook: ' + error.message);
    if (error.response) {
      addWebhookLog('Response status: ' + error.response.status);
      addWebhookLog('Response data: ' + JSON.stringify(error.response.data, null, 2));
    }
  }
}

module.exports = { handleMessage };
