const chalk = require('chalk');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

module.exports = async function find(argv) {
  const { query, limit, type } = argv;
  
  try {
    const repo = new Repository(process.cwd());
    await repo.open();

    const results = await repo.search(query);
    
    // 在命令层应用过滤
    let filtered = results;
    if (type) {
      filtered = filtered.filter(r => r.type === type);
    }
    if (limit > 0) {
      filtered = filtered.slice(0, limit);
    }
    
    await repo.close();

    if (filtered.length === 0) {
      Logger.info(`未找到匹配 "${query}" 的资源`);
      process.exit(0);
    }

    Logger.title(`搜索结果: "${query}" (共 ${filtered.length} 个)`);
    
    filtered.forEach((resource, index) => {
      const title = resource.metadata.title || '未命名';
      const typeColor = chalk.blue(resource.type);
      const created = new Date(resource.created).toLocaleDateString();
      console.log(`${index + 1}. ${title} ${typeColor} ${chalk.gray(created)}`);
      console.log(`   ${resource.path}`);
    });

    process.exit(0);

  } catch (error) {
    Logger.error(`搜索失败: ${error.message}`);
    process.exit(1);
  }
};