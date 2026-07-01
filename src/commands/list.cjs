const chalk = require('chalk');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

module.exports = async function list(argv) {
  const { type, status, tag, category, limit, format } = argv;
  
  try {
    const repo = new Repository(process.cwd());
    await repo.open();

    const options = {};
    if (type) options.type = type;
    if (limit) options.limit = limit;

    const resources = await repo.query(options);
    
    await repo.close();

    if (resources.length === 0) {
      Logger.info('暂无资源');
      return;
    }
    
    if (format === 'json') {
      console.log(JSON.stringify(resources, null, 2));
      return;
    }
    
    if (format === 'list') {
      resources.forEach((resource, index) => {
        const title = resource.metadata.title || '未命名';
        const tags = resource.metadata.tags ? resource.metadata.tags.map(t => `#${t}`).join(' ') : '';
        const cat = resource.metadata.category ? chalk.magenta(`[${resource.metadata.category}] `) : '';
        const created = new Date(resource.created).toLocaleDateString();
        console.log(`${index + 1}. ${cat}${title} ${chalk.gray(created)} ${tags}`);
      });
      return;
    }
    
    Logger.title('资源列表');
    const tableData = resources.map(resource => ({
      RID: resource.rid.substring(0, 12) + '...',
      标题: resource.metadata.title || '未命名',
      类型: resource.type,
      创建时间: new Date(resource.created).toLocaleString(),
      分类: resource.metadata.category || '-',
      标签: (resource.metadata.tags || []).join(', ') || '-'
    }));
    Logger.table(tableData);
    
  } catch (error) {
    Logger.error(`获取资源列表失败: ${error.message}`);
    process.exit(1);
  }
};