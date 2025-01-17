const chalk = require('chalk');
const axios = require('axios');

class CommandHandler {
  constructor(client, botManager, consoleUI) {
    this.client = client;
    this.botManager = botManager;
    this.consoleUI = consoleUI;
    this.currentChannel = null;
    this.currentThread = null;
    this.composingMessage = '';
  }

  async initialize() {
    try {
      try {
        const channels = await this.botManager.listChannels();
        this.currentChannel = channels.find(ch => ch.name === 'general') || channels[0];
        this.updateStatusBar();
      } catch (error) {
        this.consoleUI.addLog(chalk.red('Error initializing channels: ' + error.message));
      }
    } catch (error) {
      this.consoleUI.addLog('Error initializing channels: ' + error.message);
    }
    this.awaitingChannelSelection = false;
    this.awaitingChannelSelection = false;
  }

  updateStatusBar() {
    const status = this.client.user.presence.status;
    const channelName = this.currentChannel ? `${this.currentChannel.name} (${this.currentChannel.guildName})` : 'No channel selected';
    const threadName = this.currentThread ? ` > ${this.currentThread.name}` : '';
    const statusBarContent = `${this.client.user.tag} | ${status} | Channel: ${channelName}${threadName}`;
    this.consoleUI.updateStatusBar(statusBarContent);
  }

  getStatusBarContent() {
    const status = this.client.user.presence.status;
    const channelName = this.currentChannel ? `${this.currentChannel.name} (${this.currentChannel.guildName})` : 'No channel selected';
    const threadName = this.currentThread ? ` > ${this.currentThread.name}` : '';
    return `${this.client.user.tag} | ${status} | Channel: ${channelName}${threadName}`;
  }

  async handleInput(input) {
    this.consoleUI.addLog(chalk.green(`Executing command: ${input}`));
    if (this.awaitingChannelSelection) {
      this.handleChannelSelection(input);
      return;
    }

    if (input.startsWith('/')) {
      const [command, ...args] = input.slice(1).split(' ');
      await this.handleCommand(command.toLowerCase(), args);
    } else {
      this.composingMessage += input + '\n';
      this.consoleUI.updateComposer(this.composingMessage);
    }
  }

  async handleCommand(command, args) {
    if (!command) {
      this.consoleUI.addLog(chalk.red('No command provided. Type "/help" for a list of commands.'));
      return;
    }

    // Log command execution attempt
    console.log('Executing command:', { command, args });

    switch(command) {
      case 'help':
        this.showHelp();
        break;
      case 'status':
        await this.changeStatus(args[0]);
        break;
      case 'channel':
        await this.changeChannel(args.join(' '));
        break;
      case 'thread':
        await this.changeThread(args.join(' '));
        break;
      case 'send':
        await this.sendComposedMessage();
        break;
      case 'clear':
        this.clearComposer();
        break;
      case 'list':
        await this.listChannels();
        break;
      case 'server':
        await this.toggleServer(args[0]);
        break;
      case 'exit':
        this.consoleUI.addLog('Exiting...');
        process.exit(0);
        break;
      default:
        this.consoleUI.addLog(chalk.red('Unknown command. Type "/help" for a list of commands.'));
    }
  }

  showHelp() {
    const helpText = [
      chalk.yellow('Available commands:'),
      chalk.cyan('  /help               ') + '- Show this help message',
      chalk.cyan('  /status <newStatus> ') + '- Change bot status (online, idle, dnd, invisible)',
      chalk.cyan('  /channel <name>     ') + '- Change the current channel (will prompt if multiple channels have the same name)',
      chalk.cyan('  /thread <name>      ') + '- Change the current thread (in forum channels)',
      chalk.cyan('  /send               ') + '- Send the composed message',
      chalk.cyan('  /clear              ') + '- Clear the message composer',
      chalk.cyan('  /list               ') + '- List all available channels and threads',
      chalk.cyan('  /server <action>    ') + '- Start or stop the web server (action: start, stop)',
      chalk.cyan('  /exit               ') + '- Exit the program',
      '',
      chalk.green('Compose your message by typing or pasting. Use /send to send the message.')
    ].join('\n');
    
    this.consoleUI.addLog(helpText);
  }

  async toggleServer(action) {
    if (action === 'start') {
      const result = this.botManager.startServer();
      this.consoleUI.addLog(result);
    } else if (action === 'stop') {
      const result = this.botManager.stopServer();
      this.consoleUI.addLog(result);
    } else {
      this.consoleUI.addLog('Invalid action. Use "start" or "stop".');
    }
  }

  async changeStatus(newStatus) {
    try {
      const result = await this.botManager.changeStatus(newStatus);
      this.consoleUI.addLog(result);
      this.updateStatusBar();
    } catch (error) {
      this.consoleUI.addLog(chalk.red('Error changing status: ' + error.message));
    }
  }

  async changeChannel(channelName) {
    const channels = await this.botManager.listChannels();
    const matchingChannels = channels.filter(ch => ch.name === channelName);

    if (matchingChannels.length === 0) {
      this.consoleUI.addLog(`Channel "${channelName}" not found.`);
      return;
    }

    if (matchingChannels.length === 1) {
      this.setCurrentChannel(matchingChannels[0]);
    } else {
      this.promptChannelSelection(matchingChannels);
    }
  }

  setCurrentChannel(channel) {
    this.currentChannel = channel;
    this.currentThread = null;
    this.updateStatusBar();
    this.consoleUI.addLog(`Switched to ${channel.type} channel: ${channel.name} (${channel.guildName})`);
  }

  promptChannelSelection(channels) {
    this.consoleUI.addLog(chalk.yellow('Multiple channels found with the same name. Please select one:'));
    channels.forEach((ch, index) => {
      this.consoleUI.addLog(chalk.cyan(`${index + 1}. ${ch.name} (${ch.guildName}) - ${ch.type}`));
    });
    this.consoleUI.addLog(chalk.green('Enter the number of the channel you want to select:'));
    this.awaitingChannelSelection = true;
    this.channelSelectionOptions = channels;
    this.awaitingChannelSelection = true;
    this.channelSelectionOptions = channels;
  }

  handleChannelSelection(input) {
    const selection = parseInt(input) - 1;
    if (selection >= 0 && selection < this.channelSelectionOptions.length) {
      this.setCurrentChannel(this.channelSelectionOptions[selection]);
    } else {
      this.consoleUI.addLog(chalk.red('Invalid selection. Please use /channel command again.'));
    }
    this.awaitingChannelSelection = false;
    this.channelSelectionOptions = null;
  }

  async changeThread(threadName) {
    if (!this.currentChannel || this.currentChannel.type !== 'forum') {
      this.consoleUI.addLog('Current channel is not a forum. Select a forum channel first.');
      return;
    }

    if (!this.currentChannel || this.currentChannel.type !== 'forum') {
      this.consoleUI.addLog(chalk.red('Current channel is not a forum. Select a forum channel first.'));
      return;
    }

    const thread = this.currentChannel.threads.find(t => t.name === threadName);
    if (thread) {
      this.currentThread = thread;
      this.updateStatusBar();
      this.consoleUI.addLog(chalk.green(`Switched to thread: ${thread.name}`));
    } else {
      this.consoleUI.addLog(chalk.red(`Thread "${threadName}" not found in the current forum channel.`));
    }
  }

  async sendComposedMessage() {
    if (!this.currentChannel) {
      this.consoleUI.addLog('No channel selected. Use /channel to select a channel.');
      return;
    }
    if (this.composingMessage.trim() === '') {
      this.consoleUI.addLog('No message to send. Compose a message first.');
      return;
    }
    try {
      const result = await this.botManager.sendMessage(
        this.composingMessage.trim(),
        this.currentChannel.id,
        this.currentThread ? this.currentThread.id : null
      );
      this.consoleUI.addLog(result);
      this.clearComposer();
    } catch (error) {
      this.consoleUI.addLog(chalk.red('Error sending message: ' + error.message));
    }
  }

  clearComposer() {
    this.composingMessage = '';
    this.consoleUI.updateComposer('');
  }

  async listChannels() {
    const channels = await this.botManager.listChannels();
    let output = chalk.yellow('Available channels and threads:\n');
    channels.forEach(ch => {
      output += chalk.cyan(`${ch.name} (${ch.guildName}) - ${ch.type}\n`);
      if (ch.type === 'forum' && ch.threads) {
        ch.threads.forEach(thread => {
          output += chalk.green(`  └─ ${thread.name}\n`);
        });
      }
    });
    this.consoleUI.addLog(output.trim());
  }

  async handleFactCommand(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true }).catch(console.error);
      const response = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
      const fact = response.data.text;
      await interaction.editReply({
        content: `Here's a random fact: ${fact}`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Error fetching random fact:', error);
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'Sorry, I couldn\'t fetch a random fact at the moment.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: 'Sorry, I couldn\'t fetch a random fact at the moment.',
          ephemeral: true
        });
      }
    }
  }

  async handleStatusCommand(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const newStatus = interaction.options.getString('newstatus');
      
      if (!['online', 'idle', 'dnd', 'invisible'].includes(newStatus)) {
        await interaction.editReply({
          content: 'Invalid status. Please use one of: online, idle, dnd, invisible',
          ephemeral: true
        });
        return;
      }

      const result = await this.botManager.changeStatus(newStatus);
      const statusEmoji = {
        online: '🟢',
        idle: '🌙',
        dnd: '⛔',
        invisible: '⚪'
      };

      await interaction.editReply({ 
        content: `${statusEmoji[newStatus]} ${result}`,
        ephemeral: true 
      });
    } catch (error) {
      console.error('Error changing status:', error);
      const response = interaction.deferred ? 
        interaction.editReply : 
        interaction.reply;
      
      await response.call(interaction, { 
        content: `Error changing status: ${error.message}`,
        ephemeral: true 
      });
    }
  }

  async handleChannelCommand(interaction) {
    const channelName = interaction.options.getString('name');
    
    if (!channelName) {
      // List all channels if no name provided
      const channels = await this.botManager.listChannels();
      const channelList = channels.map(ch => 
        `- ${ch.name} (${ch.guildName}) - ${ch.type}`
      ).join('\n');
      
      await interaction.reply({
        content: `Available channels:\n${channelList}`,
        ephemeral: true
      });
      return;
    }

    try {
      const channels = await this.botManager.listChannels();
      const matchingChannel = channels.find(ch => ch.name === channelName);
      
      if (!matchingChannel) {
        await interaction.reply({
          content: `Channel "${channelName}" not found.`,
          ephemeral: true
        });
        return;
      }

      this.setCurrentChannel(matchingChannel);
      await interaction.reply({
        content: `Switched to channel: ${matchingChannel.name} (${matchingChannel.guildName})`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({
        content: `Error changing channel: ${error.message}`,
        ephemeral: true
      });
    }
  }

  async handleSendCommand(interaction) {
    const message = interaction.options.getString('message');
    if (!this.currentChannel) {
      await interaction.reply({
        content: 'No channel selected. Use /channel to select a channel first.',
        ephemeral: true
      });
      return;
    }
    
    try {
      const result = await this.botManager.sendMessage(
        message,
        this.currentChannel.id,
        this.currentThread ? this.currentThread.id : null
      );
      await interaction.reply({
        content: `Message sent successfully to ${this.currentChannel.name}`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({
        content: `Error sending message: ${error.message}`,
        ephemeral: true
      });
    }
  }

  async handleStatsCommand(interaction) {
    const stats = this.botManager.getUsageStats();
    const statsText = [
      '**Bot Statistics:**',
      `Uptime: ${stats.uptime} seconds`,
      `Last Activity: ${stats.lastActivityAgo} seconds ago`,
      `Messages Received: ${stats.messagesReceived || 0}`,
      `Commands Executed: ${stats.commandsExecuted || 0}`
    ].join('\n');

    await interaction.reply({
      content: statsText,
      ephemeral: true
    });
  }

  async handleClearCommand(interaction) {
    this.clearComposer();
    await interaction.reply({
      content: 'Message composition cleared.',
      ephemeral: true
    });
  }

  async handleHelpCommand(interaction) {
    try {
      const helpText = [
        '**Available Commands:**',
        '`/fact` - Get a random fact',
        '`/status <newstatus>` - Change bot status (online, idle, dnd, invisible)',
        '`/help` - Show this help message'
      ].join('\n');

      await interaction.reply({
        content: helpText,
        ephemeral: true
      });
    } catch (error) {
      console.error('Error showing help:', error);
      await interaction.reply({
        content: 'Sorry, there was an error displaying the help message.',
        ephemeral: true
      });
    }
  }
}

module.exports = CommandHandler;
