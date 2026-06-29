const path = require('path');
const Note = require('../core/note.cjs');
const Logger = require('../utils/logger.cjs');
const FileUtils = require('../utils/file.cjs');
const config = require('../config/default.cjs');

module.exports = async function newNote(argv) {
  const { title, tags, template, category } = argv;

  try {
    const note = await Note.create(title, {
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      template: template || 'default'
    });

    // 如果指定了分类，移动到 docs/<subdir>/
    if (category) {
      const targetDir = config.getCategoryDir(category);
      if (!targetDir) {
        Logger.warn(`分类 "${category}" 不存在（用 lo config list 查看可用分类）`);
      } else if (targetDir !== config.getDefaultDir()) {
        const filename = Note.generateFilename(title);
        const targetPath = path.join(targetDir, filename);
        await FileUtils.move(note.filePath, targetPath);
        note.filePath = targetPath;
      }
    }

    Logger.success(`✅ 笔记已创建: ${note.filePath}`);
    Logger.info('📝 标题:', note.data.title);
    Logger.info('🏷️ 标签:', note.data.tags.join(', ') || '(无)');
    Logger.info('📂 位置:', note.filePath);
    Logger.info('💡 编辑: lo edit ' + note.filePath);

  } catch (error) {
    Logger.error(`创建失败: ${error.message}`);
    process.exit(1);
  }
};