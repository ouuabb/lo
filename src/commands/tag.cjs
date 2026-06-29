const fs = require('fs-extra');
const Logger = require('../utils/logger.cjs');
const Note = require('../core/note.cjs');

module.exports = async function tag(argv) {
  const { action, file, tag } = argv;
  
  try {
    if (!fs.existsSync(file)) {
      Logger.error(`文件不存在: ${file}`);
      process.exit(1);
    }
    
    const note = Note.fromFile(file);
    
    if (action === 'add') {
      note.addTag(tag);
      Logger.success(`✅ 已添加标签 "#${tag}" 到 "${note.data.title}"`);
    } else if (action === 'rm') {
      note.removeTag(tag);
      Logger.success(`✅ 已移除标签 "#${tag}" 从 "${note.data.title}"`);
    } else {
      Logger.error('无效的操作，使用 add 或 rm');
      process.exit(1);
    }
    
  } catch (error) {
    Logger.error(`标签操作失败: ${error.message}`);
    process.exit(1);
  }
};