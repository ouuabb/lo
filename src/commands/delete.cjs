const fs = require('fs-extra');
const Logger = require('../utils/logger.cjs');
const Note = require('../core/note.cjs');

module.exports = async function deleteNote(argv) {
  const { file, force } = argv;
  
  try {
    if (!fs.existsSync(file)) {
      Logger.error(`文件不存在: ${file}`);
      process.exit(1);
    }
    
    const note = Note.fromFile(file);
    
    if (!force) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      await new Promise((resolve) => {
        readline.question(`确定要删除 "${note.data.title}" 吗？(y/n): `, async (answer) => {
          readline.close();
          if (answer.toLowerCase() !== 'y') {
            Logger.info('已取消删除');
            process.exit(0);
          }
          resolve();
        });
      });
    }
    
    await fs.remove(file);
    Logger.success(`✅ 已删除笔记: ${file}`);
    
  } catch (error) {
    Logger.error(`删除笔记失败: ${error.message}`);
    process.exit(1);
  }
};