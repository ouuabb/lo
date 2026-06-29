const Note = require('../core/note.cjs');
const Logger = require('../utils/logger.cjs');
const DateUtils = require('../utils/date.cjs');

module.exports = async function daily() {
  try {
    const date = DateUtils.today();
    const title = `${date} 日记`;
    
    const note = await Note.create(title, {
      tags: ['日记', date.substring(0, 7)],
      template: 'daily'
    });
    
    Logger.success(`✅ 今日日记已创建: ${note.filePath}`);
    Logger.info('📝 日期:', date);
    Logger.info('💡 编辑: lo edit ' + note.filePath);
    
  } catch (error) {
    Logger.error(`创建日记失败: ${error.message}`);
    process.exit(1);
  }
};