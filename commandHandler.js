const axios = require('axios');
const { addWebhookLog } = require('./consoleManager');

async function handleCommand(client, command, args) {
  switch(command) {
    case 'help':
      showHelp();
      break;
    case 'status':
      await changeStatus(client, args[0]);
      break;
    case 'fact':
      await getRandomFact(client);
      break;
    case 'send':
      if (args.length < 2) {
        addWebhookLog('Usage: /send <channel> <message>');
      } else {
        const channelName = args[0];
        const message = args.slice(1).join(' ');
        await sendMessage(client, message, channelName);
      }
      break;
    case 'list':
      listChannels(client);
      break;
    case 'exit':
      addWebhookLog('Exiting...');
      process.exit(0);
    default:
      addWebhookLog('Unknown command. Type "/help" for a list of commands.');
  }
}

function showHelp() {
  const helpText = [
    'Available commands:',
    '  /help               - Show this help message',
    '  /status <newStatus> - Change bot status (online, idle, dnd, invisible)',
    '  /fact               - Get a random fact',
    '  /send <channel> <message> - Send a message to a specific channel',
    '  /list               - List all available channels',
    '  /exit               - Exit the program',
    '  <message>           - Send a message to the default (general) channel'
  ];
  helpText.forEach(line => addWebhookLog(line));
}

async function changeStatus(client, newStatus) {
  const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
  if (!validStatuses.includes(newStatus)) {
    addWebhookLog('Invalid status. Valid options are: online, idle, dnd, invisible');
    return;
  }

  try {
    await client.user.setStatus(newStatus);
    addWebhookLog(`Status changed to ${newStatus}`);
  } catch (error) {
    addWebhookLog('Error changing status: ' + error);
  }
}

async function sendMessage(client, message, channelName = 'general') {
  try {
    const channel = client.channels.cache.find(ch => 
      ch.type === 0 && ch.name.toLowerCase() === channelName.toLowerCase()
    );

    if (channel) {
      await channel.send(message);
      addWebhookLog(`Message sent to #${channel.name} successfully!`);
    } else {
      addWebhookLog(`No channel found with name: ${channelName}`);
      listChannels(client);
    }
  } catch (error) {
    addWebhookLog('Error sending message to Discord: ' + error);
  }
}

async function getRandomFact(client) {
  try {
    const response = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
    const fact = response.data.text;
    addWebhookLog('Random Fact: ' + fact);
    
    const channel = client.channels.cache.find(channel => channel.type === 0);
    if (channel) {
      await channel.send(`Here's a random fact: ${fact}`);
      addWebhookLog('Fact sent to Discord successfully!');
    } else {
      addWebhookLog('No suitable text channel found to send the fact.');
    }
  } catch (error) {
    addWebhookLog('Error fetching random fact: ' + error);
  }
}

function listChannels(client) {
  const channels = client.channels.cache
    .filter(ch => ch.type === 0)
    .map(ch => ch.name)
    .sort();

  const columnWidth = Math.max(...channels.map(ch => ch.length)) + 2;
  const columnsPerRow = Math.floor(process.stdout.columns / columnWidth);
  
  let output = 'Available channels:\n';
  for (let i = 0; i < channels.length; i += columnsPerRow) {
    const row = channels.slice(i, i + columnsPerRow);
    output += row.map(ch => ch.padEnd(columnWidth)).join('') + '\n';
  }
  
  addWebhookLog(output.trim());
}

module.exports = { handleCommand, showHelp };
