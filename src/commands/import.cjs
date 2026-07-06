const fs = require('fs-extra');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

module.exports = async function importCmd(argv) {
  const { path: targetPath, type, category } = argv;

  try {
    if (!fs.existsSync(targetPath)) {
      Logger.error(`路径不存在: ${targetPath}`);
      process.exit(1);
    }

    const repo = new Repository(process.cwd());
    await repo.open();

    // 默认分类：未显式指定时，根据资源类型应用默认值
    const defaultNote = await repo.getConfig('category.defaultNote', '未分类');
    const defaultOther = await repo.getConfig('category.defaultOther', '其他资源');

    const stats = await fs.stat(targetPath);
    
    if (stats.isDirectory()) {
      Logger.info(`正在导入目录: ${targetPath}`);
      const resources = await repo.importDirectory(targetPath, type);
      // 为导入的资源设置默认分类
      for (const res of resources) {
        if (!category && !res.metadata.category) {
          const defCat = (res.type === 'note') ? defaultNote : defaultOther;
          await repo.resourceService.update(res.rid, {
            metadata: { ...res.metadata, category: defCat }
          });
        } else if (category) {
          await repo.resourceService.update(res.rid, {
            metadata: { ...res.metadata, category }
          });
        }
      }
      Logger.success(`成功导入 ${resources.length} 个资源`);
    } else {
      Logger.info(`正在导入文件: ${targetPath}`);
      const resource = await repo.importFile(targetPath, type);
      // 设置分类
      if (category) {
        await repo.resourceService.update(resource.rid, {
          metadata: { ...resource.metadata, category }
        });
      } else if (!resource.metadata.category) {
        const defCat = (resource.type === 'note') ? defaultNote : defaultOther;
        await repo.resourceService.update(resource.rid, {
          metadata: { ...resource.metadata, category: defCat }
        });
      }
      Logger.success(`成功导入资源: ${resource.rid}`);
      Logger.info(`类型: ${resource.type}`);
      Logger.info(`路径: ${resource.path}`);
    }

    await repo.close();

    process.exit(0);

  } catch (error) {
    Logger.error(`导入失败: ${error.message}`);
    process.exit(1);
  }
};
