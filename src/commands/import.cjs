const fs = require('fs-extra');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

module.exports = async function importCmd(argv) {
  const { path: targetPath, type } = argv;

  try {
    if (!fs.existsSync(targetPath)) {
      Logger.error(`路径不存在: ${targetPath}`);
      process.exit(1);
    }

    const repo = new Repository(process.cwd());
    await repo.open();

    const stats = await fs.stat(targetPath);
    
    if (stats.isDirectory()) {
      Logger.info(`正在导入目录: ${targetPath}`);
      const resources = await repo.importDirectory(targetPath, type);
      Logger.success(`成功导入 ${resources.length} 个资源`);
    } else {
      Logger.info(`正在导入文件: ${targetPath}`);
      const resource = await repo.importFile(targetPath, type);
      Logger.success(`成功导入资源: ${resource.rid}`);
      Logger.info(`类型: ${resource.type}`);
      Logger.info(`路径: ${resource.path}`);
    }

    await repo.close();

  } catch (error) {
    Logger.error(`导入失败: ${error.message}`);
    process.exit(1);
  }
};