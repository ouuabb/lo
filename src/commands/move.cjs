const path = require('path');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

module.exports = async function move(argv) {
  const { rid, dest } = argv;
  
  try {
    const repo = new Repository(process.cwd());
    await repo.open();

    let resource;
    
    if (rid.startsWith('res_')) {
      resource = await repo.getResource(rid);
    } else {
      resource = await repo.getResourceByPath(rid);
      if (!resource) {
        resource = await repo.getResourceByPath(process.cwd() + '/' + rid);
      }
    }
    
    if (!resource) {
      Logger.error(`资源不存在: ${rid}`);
      process.exit(1);
    }

    const targetPath = path.isAbsolute(dest) ? dest : path.join(process.cwd(), dest);
    
    await repo.moveResource(resource.rid, targetPath);
    
    Logger.success(`资源已移动: ${resource.metadata.title || '未命名资源'}`);
    Logger.info(`新位置: ${targetPath}`);
    
    await repo.close();
    
  } catch (error) {
    Logger.error(`移动资源失败: ${error.message}`);
    process.exit(1);
  }
};