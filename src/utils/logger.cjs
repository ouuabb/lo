const chalk = require('chalk');

class Logger {
  static info(msg) {
    console.log(chalk.blue('[info]') + ' ' + msg);
  }
  
  static success(msg) {
    console.log(chalk.green('[ok]') + ' ' + msg);
  }
  
  static warn(msg) {
    console.log(chalk.yellow('[warn]') + ' ' + msg);
  }
  
  static error(msg) {
    console.log(chalk.red('[err]') + ' ' + msg);
  }
  
  static table(data) {
    console.table(data);
  }
  
  static title(msg) {
    console.log('\n' + chalk.bold.cyan(msg));
    console.log(chalk.gray('-'.repeat(msg.length + 4)));
  }
}

module.exports = Logger;
