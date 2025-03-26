import readline from 'readline';
import chalk from 'chalk';
import boxen from 'boxen';

class ConsoleUI {
  constructor(rl) {
    this.rl = rl;
    this.output = '';
    this.statusBar = '';
    this.composer = '';
    this.terminalWidth = process.stdout.columns || 80;
    this.terminalHeight = process.stdout.rows || 24;
    
    // Listen for terminal resize events
    process.stdout.on('resize', () => {
      this.terminalWidth = process.stdout.columns || 80;
      this.terminalHeight = process.stdout.rows || 24;
      this.render(); // Re-render UI when terminal size changes
    });
  }

  updateStatusBar(status) {
    // Store the status but don't render immediately
    this.statusBar = status;
  }

  updateComposer(text) {
    this.composer = text;
    this.render();
  }
  
  // Add a method to display channel list
  displayChannelList(channels) {
    if (!channels || channels.length === 0) {
      this.addLog('No channels available.');
      return;
    }
    
    let output = 'Available channels:\n';
    channels.forEach(ch => {
      output += `- ${ch.name} (${ch.guildName}) - ${ch.type}\n`;
      if (ch.type === 'forum' && ch.threads) {
        ch.threads.forEach(thread => {
          output += `  └─ ${thread.name}\n`;
        });
      }
    });
    this.addLog(output.trim());
  }

  addLog(message) {
    // Add the message to output and trigger a render
    this.output += message + '\n';
    
    // Limit the output buffer to prevent excessive scrolling
    const maxLines = 100;
    const lines = this.output.split('\n');
    if (lines.length > maxLines) {
      this.output = lines.slice(lines.length - maxLines).join('\n');
    }
    
    this.render();
  }

  clearScreen() {
    // More thorough screen clearing to prevent multiple consoles
    process.stdout.write('\x1b[2J'); // Clear entire screen
    process.stdout.write('\x1b[0;0H'); // Move cursor to top-left corner
  }

  formatChannelsAndThreads(content) {
    const lines = content.split('\n');
    let formatted = '';
    let currentLine = '';

    for (const line of lines) {
      if (currentLine.length + line.length + 2 > this.terminalWidth - 4) {
        formatted += `${currentLine.trim()}\n`;
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
    try {
      // Clear the screen and reset cursor position to prevent multiple consoles
      this.clearScreen();
      
      // Create a complete UI layout in memory before printing anything
      let uiContent = '';
      
      // Add status bar at the top if it exists
      if (this.statusBar) {
        uiContent += chalk.bgBlue.white.bold(` ${this.statusBar} `) + '\n\n';
      }
      
      // Format the output content
      let formattedOutput = this.output || '';
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

      // Create output box
      const BOXEN_OPTIONS = {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        title: chalk.yellow('Output'),
        titleAlignment: 'center',
        width: this.terminalWidth - 4,
        height: this.terminalHeight - 10
      };
      const outputBox = boxen(formattedOutput, BOXEN_OPTIONS);
      uiContent += outputBox + '\n';
      
      // Create composer box
      const composerBox = boxen(this.composer || 'Type your message here...', {
        padding: 1,
        margin: 1,
        borderStyle: 'bold',
        borderColor: 'green',
        title: chalk.yellow('Composer'),
        titleAlignment: 'center'
      });
      uiContent += composerBox + '\n';
      
      // Add prompt message
      const PROMPT_MESSAGE = 'Enter a command or message:';
      uiContent += chalk.cyan(PROMPT_MESSAGE);
      
      // Print the entire UI at once
      console.log(uiContent);
      this.rl.prompt();
    } catch (error) {
      console.error('Error during rendering:', error);
    }
  }

  promptUser(callback) {
    const PROMPT_SYMBOL = '> ';
    
    // Clear the line before showing the prompt
    process.stdout.write('\r\x1b[K');
    
    this.rl.question(chalk.green(PROMPT_SYMBOL), (input) => {
      if (input.trim() === '') {
        // Add to output instead of using console.log to prevent scrolling
        this.addLog(chalk.red('Empty input is not allowed.'));
      } else {
        callback(input);
      }
      // Re-render before showing the prompt again
      this.render();
      this.promptUser(callback);
    });
  }
}

export default ConsoleUI;
