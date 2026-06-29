const chalk = require('chalk');
const Scanner = require('../core/scanner.cjs');
const Logger = require('../utils/logger.cjs');

module.exports = function list(argv) {
  const { status, tag, category, limit, format } = argv;
  
  try {
    const scanner = new Scanner();
    const notes = scanner.scan({
      status: status || null,
      tag: tag || null,
      category: category || null,
      limit: limit || 20
    });
    
    if (notes.length === 0) {
      Logger.info('暂无笔记');
      return;
    }
    
    if (format === 'json') {
      console.log(JSON.stringify(notes.map(n => n.toJSON()), null, 2));
      return;
    }
    
    if (format === 'list') {
      notes.forEach((note, index) => {
        const tags = note.data.tags ? note.data.tags.map(t => `#${t}`).join(' ') : '';
        const cat = note.data.category ? chalk.magenta(`[${note.data.category}] `) : '';
        console.log(`${index + 1}. ${cat}${note.data.title} ${chalk.gray(note.data.created)} ${tags}`);
      });
      return;
    }
    
    Logger.title('笔记列表');
    const tableData = notes.map(note => ({
      标题: note.data.title,
      创建时间: note.data.created,
      分类: note.data.category || '-',
      状态: note.data.status || 'draft',
      标签: (note.data.tags || []).join(', ') || '-'
    }));
    Logger.table(tableData);
    
  } catch (error) {
    Logger.error(`获取笔记列表失败: ${error.message}`);
    process.exit(1);
  }
};