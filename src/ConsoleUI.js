class ConsoleUI {
    constructor(readline, client) {
      this.rl = readline;
      this.client = client;
      this.logs = [];
      this.maxLogs = 10;
    }
  
    addLog(log) {
      this.logs.push(log);
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }
    }
  
    updateConsole() {
      console.clear();
  
      const availableLines = process.stdout.rows - 3;
      let flatLogs = this.logs.flatMap(log => log.split('\n'));
  
      while (flatLogs.length > availableLines) {
        flatLogs.shift();
      }
  
      flatLogs.forEach(log => console.log(log));
      
      const emptyLines = availableLines - flatLogs.length;
      for (let i = 0; i < emptyLines; i++) {
        console.log();
      }
  
      this.printStatusBar();
      this.rl.prompt(true);
    }
  
    printStatusBar() {
      const userName = this.client.user ? this.client.user.username : 'Not logged in';
      const status = this.client.user ? this.client.user.presence.status : 'offline';
      const statusBarContent = `${userName} | ${status}`;
      const padding = process.stdout.columns - statusBarContent.length - 4;
      const statusBar = `--[${statusBarContent}]${'-'.repeat(Math.max(padding, 0))}--`;
      console.log(statusBar.slice(0, process.stdout.columns));
    }
  
    promptUser(callback) {
      this.rl.question('Enter a command or message (type "/help" for options): ', async (input) => {
        this.updateConsole();
        await callback(input);
        this.updateConsole();
        this.promptUser(callback);
      });
    }
  }
  
  module.exports = ConsoleUI;