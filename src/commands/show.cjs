const fs = require('fs-extra');
const chalk = require('chalk');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

module.exports = async function show(argv) {
  const { rid, raw } = argv;
  
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
    
    await repo.close();

    if (!resource) {
      Logger.error(`资源不存在: ${rid}`);
      process.exit(1);
    }

    if (raw) {
      const content = await fs.readFile(resource.path, 'utf-8');
      console.log(content);
      return;
    }

    Logger.title(resource.metadata.title || '未命名资源');
    console.log(chalk.gray(`RID: ${resource.rid}`));
    console.log(chalk.gray(`类型: ${resource.type}`));
    console.log(chalk.gray(`路径: ${resource.path}`));
    console.log(chalk.gray(`创建时间: ${new Date(resource.created).toLocaleString()}`));
    
    if (resource.metadata.tags && resource.metadata.tags.length > 0) {
      console.log(chalk.gray(`标签: ${resource.metadata.tags.join(', ')}`));
    }
    
    if (resource.metadata.category) {
      console.log(chalk.gray(`分类: ${resource.metadata.category}`));
    }

    console.log('\n' + '='.repeat(50) + '\n');

    const content = await fs.readFile(resource.path, 'utf-8');
    console.log(content);

  } catch (error) {
    Logger.error(`查看资源失败: ${error.message}`);
    process.exit(1);
  }
};