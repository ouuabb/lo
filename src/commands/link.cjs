const fs = require('fs-extra');
const Logger = require('../utils/logger.cjs');
const Note = require('../core/note.cjs');

module.exports = async function link(argv) {
  const { from, to } = argv;
  
  try {
    if (!fs.existsSync(from)) {
      Logger.error(`源文件不存在: ${from}`);
      process.exit(1);
    }
    
    if (!fs.existsSync(to)) {
      Logger.error(`目标文件不存在: ${to}`);
      process.exit(1);
    }
    
    const fromNote = Note.fromFile(from);
    const toNote = Note.fromFile(to);
    
    if (!fromNote.content.includes(`[[${toNote.data.title}]]`)) {
      fromNote.content += `\n\n[[${toNote.data.title}]]`;
      await fromNote.save();
      Logger.success(`✅ 已在 "${fromNote.data.title}" 中添加链接到 "${toNote.data.title}"`);
    } else {
      Logger.info('链接已存在');
    }
    
    if (!toNote.content.includes(`[[${fromNote.data.title}]]`)) {
      toNote.content += `\n\n[[${fromNote.data.title}]]`;
      await toNote.save();
      Logger.success(`✅ 已在 "${toNote.data.title}" 中添加链接到 "${fromNote.data.title}"`);
    } else {
      Logger.info('反向链接已存在');
    }
    
  } catch (error) {
    Logger.error(`建立链接失败: ${error.message}`);
    process.exit(1);
  }
};