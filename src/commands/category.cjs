const path = require('path');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');
const StagingArea = require('../repo/staging.cjs');

module.exports = async function category(argv) {
  const { action, rid, category: catValue } = argv;
  
  try {
    const repo = new Repository(process.cwd());
    await repo.open();

    let resource;
    
    if (rid.startsWith('res_')) {
      resource = await repo.getResource(rid);
    } else {
      resource = await repo.getResourceByPath(rid);
      if (!resource) {
        resource = await repo.getResourceByPath(path.join(process.cwd(), rid));
      }
    }
    
    if (!resource) {
      Logger.error(`资源不存在: ${rid}`);
      process.exit(1);
    }

    const staging = new StagingArea(repo.repoPath);
    const stagingStatus = await staging.getStatus();

    switch (action) {
      case 'set':
        if (!catValue) {
          Logger.error('请指定分类名称');
          process.exit(1);
        }
        {
          await staging.stageMetadata(resource.rid, { category: catValue });
          Logger.success(`已暂存分类变更: "${catValue}"（需 lo commit 提交）`);
        }
        break;
        
      case 'rm':
        {
          await staging.stageMetadata(resource.rid, { category: '' });
          Logger.success('已暂存分类移除（需 lo commit 提交）');
        }
        break;
        
      case 'list':
        Logger.title(`资源 "${resource.metadata.title || '未命名'}" 的分类`);
        console.log(resource.metadata.category || '(未设置)');
        // 检查是否有暂存的分类变更
        const pendingMeta = (stagingStatus.metadata || []).find(m => m.rid === resource.rid);
        if (pendingMeta && pendingMeta.category !== undefined) {
          Logger.warn(`暂存区有未提交的分类变更: "${pendingMeta.category || '(已移除)'}"`);
        }
        break;
        
      default:
        Logger.error('请指定操作: set, rm, list');
        process.exit(1);
    }
    
    await repo.close();
    
    process.exit(0);
    
  } catch (error) {
    Logger.error(`分类操作失败: ${error.message}`);
    process.exit(1);
  }
};
