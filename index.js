require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const readline = require('readline');
const { handleMessage } = require('./messageHandler');
const { handleCommand, showHelp } = require('./commandHandler');
const { updateConsole } = require('./consoleManager');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log('Type "/help" for a list of commands.');
  updateConsole();
  promptUser();
});

client.on('messageCreate', handleMessage);

function promptUser() {
  rl.question('Enter a command or message (type "/help" for options): ', async (input) => {
    updateConsole();

    if (input.startsWith('/')) {
      const [command, ...args] = input.slice(1).split(' ');
      await handleCommand(client, command.toLowerCase(), args);
    } else {
      await handleCommand(client, 'send', ['general', input]);
    }

    updateConsole();
    promptUser();
  });
}

client.login(process.env.DISCORD_TOKEN).catch(console.error);

process.on('SIGINT', () => {
  console.log('\nGracefully shutting down...');
  client.destroy();
  rl.close();
  process.exit(0);
});
