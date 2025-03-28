// Load environment variables from the .env file.
import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { initializeBotManager, app, server, io } from './src/api/server.js';
import readline from 'readline';
import chalk from 'chalk';
import BotManager from './src/BotManager.js';
import ConsoleUI from './src/ConsoleUI.js';
import CommandHandler from './src/CommandHandler.js';
import fs from 'fs';

// Create a new Discord.js client instance with required intents.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping
  ],
  partials: ['CHANNEL', 'MESSAGE', 'USER', 'GUILD_MEMBER', 'REACTION'], // Enable partials for DM handling
  allowedMentions: { parse: ['users', 'roles'], repliedUser: true }
});

// Log environment variables to file instead of console
fs.appendFileSync('console.log', `${new Date().toISOString()} - Environment variables:\n`);
fs.appendFileSync('console.log', `${new Date().toISOString()} - WEBHOOK_URL set: ${!!process.env.WEBHOOK_URL}\n`);
fs.appendFileSync('console.log', `${new Date().toISOString()} - DM_WEBHOOK_URL set: ${!!process.env.DM_WEBHOOK_URL}\n`);
fs.appendFileSync('console.log', `${new Date().toISOString()} - Are webhook URLs different? ${process.env.WEBHOOK_URL !== process.env.DM_WEBHOOK_URL}\n`);

// Create a readline interface for command-line I/O.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('SIGINT', () => {
  rl.question('Are you sure you want to exit? (y/n) ', (answer) => {
    if (answer.match(/^y(es)?$/i)) {
      rl.close();
      process.exit(0);
    }
  });
});

// Initialize UI components
const consoleUI = new ConsoleUI(rl);
let botManager;
let commandHandler;

// Define slash commands
const commands = [
  {
    name: 'fact',
    description: 'Get a random fact',
  },
  // Add more slash commands here as needed
];

// Function to register slash commands
async function registerSlashCommands() {
  try {
    fs.appendFileSync('console.log', `${new Date().toISOString()} - Started refreshing application (/) commands.\n`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

    fs.appendFileSync('console.log', `${new Date().toISOString()} - Successfully reloaded application (/) commands.\n`);
    commands.forEach(command => {
      fs.appendFileSync('console.log', `${new Date().toISOString()} - Registered command: ${command.name} - ${command.description}\n`);
    });
  } catch (error) {
    fs.appendFileSync('console.log', `${new Date().toISOString()} - Error registering slash commands: ${error}\n`);
    console.error('Error registering slash commands:', error);
  }
}

// Event listener for when the client is ready.
client.once('ready', async () => {
  // Initialize bot components after client is ready
  botManager = new BotManager(client, process.env.WEBHOOK_URL, process.env.DM_WEBHOOK_URL);
  commandHandler = new CommandHandler(client, botManager, consoleUI);

  try {
    await initializeBotManager(client);
  } catch (error) {
    console.error('Failed to initialize bot manager:', error);
    process.exit(1);
  }

  // Check webhook status
  try {
    const webhookStatus = await botManager.checkWebhooks();
    if (!webhookStatus.regular) {
      consoleUI.addLog(chalk.red.bold('WARNING: Regular webhook is OFFLINE! Messages will not be processed correctly.'));
    }
    if (!webhookStatus.dm) {
      consoleUI.addLog(chalk.red.bold('WARNING: DM webhook is OFFLINE! Direct messages will not be processed correctly.'));
    }
    if (!webhookStatus.regular || !webhookStatus.dm) {
      consoleUI.addLog(chalk.yellow('Please check your webhook configurations and ensure they are accessible.'));
    } else {
      consoleUI.addLog(chalk.green('All webhooks are online and responding.'));
    }
  } catch (error) {
    consoleUI.addLog(chalk.red(`Error checking webhooks: ${error.message}`));
  }

  consoleUI.addLog(`Logged in as ${client.user.tag}!`);
  consoleUI.addLog('Type "/help" for a list of commands.');

  // Log guild and channel information to debug log instead of console
  const debugInfo = {
    guilds: client.guilds.cache.size,
    channels: []
  };

  for (const guild of client.guilds.cache.values()) {
    const textChannels = guild.channels.cache.filter(ch =>
      ch.isTextBased && ch.isTextBased()
    );

    debugInfo.channels.push({
      guild: guild.name,
      id: guild.id,
      channelCount: guild.channels.cache.size,
      textChannelCount: textChannels.size
    });
  }

  // Log to debug file instead of console output
  if (process.env.DEBUG === 'true') {
    console.debug('Bot debug info:', JSON.stringify(debugInfo, null, 2));
  }

  await commandHandler.initialize(); // Initialize the current channel
  await registerSlashCommands(); // Register slash commands

  const serverStatus = await botManager.checkServerStatus();
  consoleUI.addLog(`Web server status: ${serverStatus}`);
  consoleUI.promptUser(commandHandler.handleInput.bind(commandHandler));
});

// Event listener for new messages.
client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Ignore messages from bots

  // Log message type for debugging
  if (process.env.DEBUG === 'true') {
    const isDM = !message.guild;
    console.debug(`Received message: ${isDM ? 'DM' : 'Guild'} from ${message.author.username}`);
  }

  // For DMs, ensure the channel is fully fetched
  if (!message.guild) {
    try {
      // Ensure DM channel is fully loaded
      const dmChannel = await client.channels.fetch(message.channel.id);
      if (dmChannel) {
        console.log(`Successfully fetched DM channel: ${dmChannel.id}`);
      }
    } catch (error) {
      console.error('Error fetching DM channel:', error);
    }
  }

  await botManager.handleIncomingMessage(message);
  consoleUI.updateStatusBar(commandHandler.getStatusBarContent());
});

// Event listener for slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'fact') {
    await commandHandler.handleFactCommand(interaction);
  }
  // Add more command handlers here as needed
});


if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is not set in the environment variables.');
  process.exit(1);
}

if (!process.env.API_PORT || !process.env.API_HOST) {
  console.error('API_PORT or API_HOST is not set in the environment variables.');
  process.exit(1);
}

// Log in to Discord.
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('Failed to log in:', error);
  console.log('Please check your DISCORD_TOKEN in the environment variables.');
  process.exit(1);
});

// Handle unhandled promise rejections.
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Log the current working directory only in debug mode
if (process.env.DEBUG === 'true') {
  console.log('Current working directory:', process.cwd());
}

// Add a debug endpoint
app.get('/api/debug', async (req, res) => {
  try {
    const debugInfo = {
      botReady: client.isReady(),
      guilds: client.guilds.cache.size,
      channels: [],
      uptime: Math.floor(process.uptime()),
      timestamp: Date.now()
    };

    // Get channels from all guilds
    for (const guild of client.guilds.cache.values()) {
      try {
        const guildChannels = Array.from(guild.channels.cache.values())
          .filter(ch => ch.isTextBased && ch.isTextBased())
          .map(ch => ({
            id: ch.id,
            name: ch.name,
            type: ch.type,
            guildName: guild.name
          }));

        debugInfo.channels.push(...guildChannels);
      } catch (error) {
        console.error(`Error getting channels for guild ${guild.name}:`, error);
      }
    }

    res.json(debugInfo);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.API_PORT || 6987;
const HOST = process.env.API_HOST || '0.0.0.0';

// Only log server configuration in debug mode or store it for the UI
if (process.env.DEBUG === 'true') {
  console.log(`Configured API server to run on http://${HOST}:${PORT}`);
}

// Start the server using the imported server instance
const startServer = () => {
  return new Promise((resolve, reject) => {
    try {
      server.listen(PORT, HOST, (error) => {
        if (error) {
          console.error('Failed to start server:', error);
          reject(error);
          return;
        }
        // Add to UI output instead of console
        if (consoleUI) {
          consoleUI.addLog(chalk.green(`API server running on http://${HOST}:${PORT}`));
        } else if (process.env.DEBUG === 'true') {
          console.log(`API server successfully running on http://${HOST}:${PORT}`);
          console.log(`WebSocket server is available at ws://${HOST}:${PORT}`);
        }
        resolve(server);
      });

      // Graceful shutdown
      const shutdown = async () => {
        console.log('Shutdown signal received');
        try {
          if (server) {
            await new Promise(resolve => server.close(resolve));
            console.log('HTTP server closed');
          }
          if (client) {
            await client.destroy();
            console.log('Discord client destroyed');
          }
        } catch (error) {
          console.error('Error during shutdown:', error);
        } finally {
          console.log('Exiting process...');
          process.exit(0);
        }
      };

      const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'];
      signals.forEach(signal => {
        process.on(signal, shutdown);
      });

    } catch (error) {
      console.error('Critical server error:', error);
      reject(error);
    }
  });
};

// Start the server and handle any errors
startServer().catch(error => {
  console.error('Failed to start server:', error);
  console.log('Ensure that the API_PORT and API_HOST are correctly configured.');
  process.exit(1);
});
