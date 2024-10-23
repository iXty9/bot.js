const axios = require('axios');

class CommandHandler {
  constructor(client, botManager, consoleUI) {
    this.client = client;
    this.botManager = botManager;
    this.consoleUI = consoleUI;
  }

  async handleInput(input) {
    if (input.startsWith('/')) {
      const [command, ...args] = input.slice(1).split(' ');
      await this.handleCommand(command.toLowerCase(), args);
    } else {
      await this.sendMessage(input);
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
      case 'fact':
        await this.getRandomFact();
        break;
      case 'send':
        await this.sendMessage(args.slice(1).join(' '), args[0]);
        break;
      case 'list':
        this.listChannels();
        break;
      case 'exit':
        this.consoleUI.addLog('Exiting...');
        process.exit(0);
      default:
        this.consoleUI.addLog('Unknown command. Type "/help" for a list of commands.');
    }
  }

  showHelp() {
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
    helpText.forEach(line => this.consoleUI.addLog(line));
  }

  async changeStatus(newStatus) {
    try {
      const result = await this.botManager.changeStatus(newStatus);
      this.consoleUI.addLog(result);
    } catch (error) {
      this.consoleUI.addLog('Error changing status: ' + error);
    }
  }

  async sendMessage(message, channelName = 'general') {
    try {
      const result = await this.botManager.sendMessage(message, channelName);
      this.consoleUI.addLog(result);
    } catch (error) {
      this.consoleUI.addLog('Error sending message: ' + error);
    }
  }

  async getRandomFact() {
    try {
      const response = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
      const fact = response.data.text;
      this.consoleUI.addLog('Random Fact: ' + fact);
      await this.sendMessage(`Here's a random fact: ${fact}`);
    } catch (error) {
      this.consoleUI.addLog('Error fetching random fact: ' + error);
    }
  }

  listChannels() {
    const channels = this.botManager.listChannels();
    const columnWidth = Math.max(...channels.map(ch => ch.length)) + 2;
    const columnsPerRow = Math.floor(process.stdout.columns / columnWidth);
    
    let output = 'Available channels:\n';
    for (let i = 0; i < channels.length; i += columnsPerRow) {
      const row = channels.slice(i, i + columnsPerRow);
      output += row.map(ch => ch.padEnd(columnWidth)).join('') + '\n';
    }
    
    this.consoleUI.addLog(output.trim());
  }
}

module.exports = CommandHandler;