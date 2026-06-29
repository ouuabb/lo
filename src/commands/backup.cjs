const fs = require('fs-extra');
const path = require('path');
const Logger = require('../utils/logger.cjs');
const DateUtils = require('../utils/date.cjs');
const config = require('../config/default.cjs');

module.exports = async function backup(argv) {
  const { dest, compress } = argv;

  try {
    const backupDir = dest || './backups';
    const timestamp = DateUtils.format(new Date(), 'YYYY-MM-DD-HH-mm-ss');
    const backupPath = path.join(backupDir, `backup-${timestamp}`);

    Logger.info(`正在备份到: ${backupPath}`);

    await fs.ensureDir(backupDir);

    // 备份 docs/ 目录和 templates/
    const directories = [config.ROOT_DIR, 'templates'];
    for (const dir of directories) {
      if (await fs.pathExists(dir)) {
        await fs.copy(dir, path.join(backupPath, dir));
      }
    }

    Logger.success(`备份完成: ${backupPath}`);

  } catch (error) {
    Logger.error(`备份失败: ${error.message}`);
    process.exit(1);
  }
};