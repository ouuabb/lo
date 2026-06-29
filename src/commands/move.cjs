const fs = require('fs-extra');
const path = require('path');
const Logger = require('../utils/logger.cjs');
const FileUtils = require('../utils/file.cjs');
const Note = require('../core/note.cjs');
const config = require('../config/default.cjs');

module.exports = async function move(argv) {
  const { file, dest, category } = argv;

  try {
    if (!fs.existsSync(file)) {
      Logger.error(`文件不存在: ${file}`);
      process.exit(1);
    }

    let targetPath;

    if (category) {
      const targetDir = config.getCategoryDir(category);
      if (!targetDir) {
        Logger.error(`无效的分类: ${category}`);
        process.exit(1);
      }
      const filename = path.basename(file);
      targetPath = path.join(targetDir, filename);
    } else if (dest) {
      targetPath = dest;
    } else {
      Logger.error('请指定目标路径或分类');
      process.exit(1);
    }

    // 确保目标目录存在
    await fs.ensureDir(path.dirname(targetPath));
    await FileUtils.move(file, targetPath);
    Logger.success(`✅ 已移动笔记到: ${targetPath}`);

  } catch (error) {
    Logger.error(`移动笔记失败: ${error.message}`);
    process.exit(1);
  }
};