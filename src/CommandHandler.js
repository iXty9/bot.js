const chalk = require('chalk');

class CommandHandler {
  constructor(client, botManager, consoleUI) {
    this.client = client;
    this.botManager = botManager;
    this.consoleUI = consoleUI;
    this.currentChannel = null;
    this.composingMessage = '';
  }

  async initialize() {
    const channels = await this.botManager.listChannels();
    this.currentChannel = channels.find(ch => ch.name === 'general') || channels[0];
    this.updateStatusBar();
  }

  updateStatusBar() {
    const status = this.client.user.presence.status;
    const channelName = this.currentChannel ? `${this.currentChannel.name} (${this.currentChannel.guildName})` : 'No channel selected';
    this.consoleUI.updateStatusBar(`${this.client.user.tag} | ${status} | Channel: ${channelName}`);
  }

  getStatusBarContent() {
    const status = this.client.user.presence.status;
    const channelName = this.currentChannel ? `${this.currentChannel.name} (${this.currentChannel.guildName})` : 'No channel selected';
    return `${this.client.user.tag} | ${status} | Channel: ${channelName}`;
  }

  async handleInput(input) {
    if (input.startsWith('/')) {
      const [command, ...args] = input.slice(1).split(' ');
      await this.handleCommand(command.toLowerCase(), args);
    } else {
      this.composingMessage += input + '\n';
      this.consoleUI.updateComposer(this.composingMessage);
    }
  }

  async handleCommand(command, args) {
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
      case 'send':
        await this.sendComposedMessage();
        break;
      case 'clear':
        this.clearComposer();
        break;
      case 'list':
        await this.listChannels();
        break;
      case 'exit':
        this.consoleUI.addLog('Exiting...');
        process.exit(0);
        break;
      default:
        this.consoleUI.addLog('Unknown command. Type "/help" for a list of commands.');
    }
  }

  showHelp() {
    const helpText = [
      chalk.yellow('Available commands:'),
      chalk.cyan('  /help               ') + '- Show this help message',
      chalk.cyan('  /status <newStatus> ') + '- Change bot status (online, idle, dnd, invisible)',
      chalk.cyan('  /channel <name>     ') + '- Change the current channel',
      chalk.cyan('  /send               ') + '- Send the composed message',
      chalk.cyan('  /clear              ') + '- Clear the message composer',
      chalk.cyan('  /list               ') + '- List all available channels',
      chalk.cyan('  /exit               ') + '- Exit the program',
      chalk.green('Compose your message by typing or pasting. Use Ctrl+S to send.')
    ];
    helpText.forEach(line => this.consoleUI.addLog(line));
  }

  async changeStatus(newStatus) {
    try {
      const result = await this.botManager.changeStatus(newStatus);
      this.consoleUI.addLog(result);
      this.updateStatusBar();
    } catch (error) {
      this.consoleUI.addLog('Error changing status: ' + error);
    }
  }

  async changeChannel(channelName) {
    const channels = await this.botManager.listChannels();
    const channel = channels.find(ch => ch.name === channelName);
    if (channel) {
      this.currentChannel = channel;
      this.updateStatusBar();
      this.consoleUI.addLog(`Switched to channel: ${channel.name} (${channel.guildName})`);
    } else {
      this.consoleUI.addLog(`Channel "${channelName}" not found.`);
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
      const result = await this.botManager.sendMessage(this.composingMessage.trim(), this.currentChannel.id);
      this.consoleUI.addLog(result);
      this.clearComposer();
    } catch (error) {
      this.consoleUI.addLog('Error sending message: ' + error);
    }
  }

  clearComposer() {
    this.composingMessage = '';
    this.consoleUI.updateComposer('');
  }

  async listChannels() {
    const channels = await this.botManager.listChannels();
    let output = chalk.yellow('Available channels:\n');
    channels.forEach(ch => {
      output += chalk.cyan(`${ch.name} (${ch.guildName})\n`);
    });
    this.consoleUI.addLog(output.trim());
  }
}

module.exports = CommandHandler;
