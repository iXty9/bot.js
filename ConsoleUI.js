const readline = require('readline');
const chalk = require('chalk');
const boxen = require('boxen');

class ConsoleUI {
  constructor(rl) {
    this.rl = rl;
    this.output = '';
    this.statusBar = '';
    this.composer = '';
    this.terminalWidth = process.stdout.columns;
    this.terminalHeight = process.stdout.rows;
  }

  updateStatusBar(status) {
    this.statusBar = status;
    this.render();
  }

  updateComposer(text) {
    this.composer = text;
    this.render();
  }

  addLog(message) {
    this.output = message;
    this.render();
  }

  clearScreen() {
    process.stdout.write('\x1b[2J');
    process.stdout.write('\x1b[3J');
    process.stdout.write('\x1b[H');
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
  }

  formatChannelsAndThreads(content) {
    const lines = content.split('\n');
    let formatted = '';
    let currentLine = '';

    for (const line of lines) {
      if (currentLine.length + line.length + 2 > this.terminalWidth - 4) {
        formatted += currentLine.trim() + '\n';
        currentLine = '';
      }
      currentLine += line + '  ';
    }
    formatted += currentLine.trim();

    return formatted;
  }

  formatHelpText(helpText) {
    return helpText.map(line => {
      if (line.startsWith('  ')) {
        const [command, description] = line.split(' - ');
        return chalk.cyan(command.padEnd(30)) + ' - ' + description;
      }
      return chalk.yellow(line);
    }).join('\n');
  }

  render() {
    this.clearScreen();
    
    console.log(chalk.bgBlue.white.bold(` ${this.statusBar} `));
    
    let formattedOutput = this.output;

    if (this.output.includes('Available commands:')) {
      const [preHelp, helpContent] = this.output.split('Available commands:');
      const helpLines = helpContent.trim().split('\n');
      const formattedHelp = this.formatHelpText(helpLines);
      formattedOutput = preHelp + 'Available commands:\n' + formattedHelp;
    } else if (this.output.includes('Available channels and threads:')) {
      const [preChannels, channelsContent] = this.output.split('Available channels and threads:');
      const formattedChannels = this.formatChannelsAndThreads(channelsContent);
      formattedOutput = preChannels + 'Available channels and threads:\n' + formattedChannels;
    }

    const outputBox = boxen(formattedOutput, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
      title: chalk.yellow('Output'),
      titleAlignment: 'center',
      width: this.terminalWidth - 4,
      height: this.terminalHeight - 10
    });
    console.log(outputBox);
    
    const composerBox = boxen(this.composer || 'Type your message here...', {
      padding: 1,
      margin: 1,
      borderStyle: 'bold',
      borderColor: 'green',
      title: chalk.yellow('Composer'),
      titleAlignment: 'center'
    });
    console.log(composerBox);
    
    console.log(chalk.cyan('Enter a command or message:'));
    this.rl.prompt();
  }

  promptUser(callback) {
    this.rl.question(chalk.green('> '), (input) => {
      callback(input);
      this.promptUser(callback);
    });
  }
}

module.exports = ConsoleUI;
