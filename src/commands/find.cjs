const chalk = require('chalk');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

module.exports = async function find(argv) {
  const { query, limit, type } = argv;
  
  try {
    const repo = new Repository(process.cwd());
    await repo.open();

    const results = await repo.search(query);
    
    await repo.close();

    if (results.length === 0) {
      Logger.info(`未找到匹配 "${query}" 的资源`);
      return;
    }

    Logger.title(`搜索结果: "${query}" (共 ${results.length} 个)`);
    
    results.forEach((resource, index) => {
      const title = resource.metadata.title || '未命名';
      const typeColor = chalk.blue(resource.type);
      const created = new Date(resource.created).toLocaleDateString();
      console.log(`${index + 1}. ${title} ${typeColor} ${chalk.gray(created)}`);
      console.log(`   ${resource.path}`);
    });

  } catch (error) {
    Logger.error(`搜索失败: ${error.message}`);
    process.exit(1);
  }
};