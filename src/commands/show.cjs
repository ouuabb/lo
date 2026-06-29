const fs = require('fs-extra');
const chalk = require('chalk');
const Logger = require('../utils/logger.cjs');
const Note = require('../core/note.cjs');

module.exports = function show(argv) {
  const { file, raw } = argv;
  
  try {
    if (!fs.existsSync(file)) {
      Logger.error(`文件不存在: ${file}`);
      process.exit(1);
    }
    
    const note = Note.fromFile(file);
    
    if (raw) {
      const content = fs.readFileSync(file, 'utf-8');
      console.log(content);
      return;
    }
    
    Logger.title(note.data.title);
    console.log(chalk.gray('创建时间: ' + note.data.created));
    if (note.data.tags && note.data.tags.length > 0) {
      console.log(chalk.blue('标签: ') + note.data.tags.map(t => `#${t}`).join(' '));
    }
    console.log(chalk.yellow('状态: ') + (note.data.status || 'draft'));
    console.log('\n' + note.content);
    
  } catch (error) {
    Logger.error(`查看笔记失败: ${error.message}`);
    process.exit(1);
  }
};