const fs = require('fs-extra');
const path = require('path');
const Logger = require('../utils/logger.cjs');
const DateUtils = require('../utils/date.cjs');

module.exports = async function backup(argv) {
  const { dest, compress } = argv;
  
  try {
    const backupDir = path.resolve(dest);
    await fs.ensureDir(backupDir);
    
    const timestamp = DateUtils.format(new Date(), 'YYYY-MM-DD-HH-mm-ss');
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(backupDir, backupName);
    
    await fs.copy(process.cwd(), backupPath, {
      filter: (src) => {
        const rel = path.relative(process.cwd(), src);
        return !rel.startsWith('node_modules') && 
               !rel.startsWith('.git') &&
               !rel.startsWith('backups') &&
               !rel.startsWith('.repo' + path.sep + 'keys');
      }
    });

    Logger.success(`备份完成: ${backupPath}`);
    Logger.info(`备份大小: ${await getDirSize(backupPath)}`);

    process.exit(0);

  } catch (error) {
    Logger.error(`备份失败: ${error.message}`);
    process.exit(1);
  }
};

async function getDirSize(dir) {
  let size = 0;
  const files = await fs.readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      size += await getDirSize(fullPath);
    } else {
      const stat = await fs.stat(fullPath);
      size += stat.size;
    }
  }
  
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}