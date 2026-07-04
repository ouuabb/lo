const path = require('path');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

module.exports = async function unlink(argv) {
  const { from, to, type = 'reference' } = argv;
  
  try {
    const repo = new Repository(process.cwd());
    await repo.open();

    let resourceA, resourceB;

    if (from.startsWith('res_')) {
      resourceA = await repo.getResource(from);
    } else {
      resourceA = await repo.getResourceByPath(from);
      if (!resourceA) {
        resourceA = await repo.getResourceByPath(path.join(process.cwd(), from));
      }
    }

    if (to.startsWith('res_')) {
      resourceB = await repo.getResource(to);
    } else {
      resourceB = await repo.getResourceByPath(to);
      if (!resourceB) {
        resourceB = await repo.getResourceByPath(path.join(process.cwd(), to));
      }
    }

    if (!resourceA) {
      Logger.error(`源资源不存在: ${from}`);
      process.exit(1);
    }
    
    if (!resourceB) {
      Logger.error(`目标资源不存在: ${to}`);
      process.exit(1);
    }
    
    await repo.unlinkResources(resourceA.rid, resourceB.rid, type);
    
    Logger.success(`已解除链接: ${resourceA.metadata.title} ↔ ${resourceB.metadata.title}`);
    Logger.info(`链接类型: ${type}`);
    
    await repo.close();
    
    process.exit(0);
    
  } catch (error) {
    Logger.error(`解除链接失败: ${error.message}`);
    process.exit(1);
  }
};
