const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

module.exports = async function tag(argv) {
  const { action, rid, tag } = argv;
  
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

    const currentTags = resource.metadata.tags || [];
    let updatedTags;

    switch (action) {
      case 'add':
        if (!tag) {
          Logger.error('请指定标签名称');
          process.exit(1);
        }
        if (currentTags.includes(tag)) {
          Logger.info(`标签 "${tag}" 已存在`);
        } else {
          updatedTags = [...currentTags, tag];
          await repo.updateResource(resource.rid, {
            metadata: { ...resource.metadata, tags: updatedTags }
          });
          Logger.success(`已添加标签: ${tag}`);
        }
        break;
        
      case 'rm':
        if (!tag) {
          Logger.error('请指定标签名称');
          process.exit(1);
        }
        updatedTags = currentTags.filter(t => t !== tag);
        await repo.updateResource(resource.rid, {
          metadata: { ...resource.metadata, tags: updatedTags }
        });
        Logger.success(`已移除标签: ${tag}`);
        break;
        
      case 'list':
        Logger.title(`资源 "${resource.metadata.title || '未命名'}" 的标签`);
        if (currentTags.length === 0) {
          Logger.info('暂无标签');
        } else {
          currentTags.forEach((t, i) => {
            console.log(`${i + 1}. ${t}`);
          });
        }
        break;
    }
    
    await repo.close();
    
  } catch (error) {
    Logger.error(`标签操作失败: ${error.message}`);
    process.exit(1);
  }
};