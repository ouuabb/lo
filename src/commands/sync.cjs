const chalk = require('chalk');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

module.exports = async function sync(argv) {
  try {
    const { full, quiet } = argv;
    
    const repo = new Repository(process.cwd());
    await repo.open();

    const lastSync = await repo.getLastSyncTime();
    const lastSyncStr = lastSync > 0 
      ? new Date(lastSync).toLocaleString() 
      : '从未';
    
    if (!quiet) {
      Logger.info(`上次同步: ${lastSyncStr}`);
      Logger.info(`正在同步资源${full ? ' (全量)' : ''}...`);
    }

    const result = await repo.sync({ full });
    
    await repo.close();

    if (!quiet) {
      Logger.title('同步报告');
      
      if (result.added.length > 0) {
        console.log(chalk.green(`+ 新增: ${result.added.length}`));
        result.added.forEach(item => {
          console.log(`  - ${chalk.cyan(item.type)}: ${item.path}`);
        });
      }

      if (result.updated.length > 0) {
        console.log(chalk.yellow(`~ 更新: ${result.updated.length}`));
        result.updated.forEach(item => {
          console.log(`  - ${chalk.cyan(item.type)}: ${item.path}`);
        });
      }

      if (result.deleted.length > 0) {
        console.log(chalk.red(`- 删除: ${result.deleted.length}`));
        result.deleted.forEach(item => {
          console.log(`  - ${chalk.cyan(item.type)}: ${item.path}`);
        });
      }

      if (result.skipped.length > 0) {
        console.log(chalk.gray(`? 跳过: ${result.skipped.length}`));
        result.skipped.forEach(item => {
          console.log(`  - ${item.path}`);
          console.log(`    ${chalk.red(item.error)}`);
        });
      }

      if (result.total === 0 && result.skipped.length === 0) {
        console.log(chalk.gray('  没有变化'));
      }

      Logger.success(`同步完成，共处理 ${result.total} 个资源`);
    }

  } catch (error) {
    Logger.error(`同步失败: ${error.message}`);
    process.exit(1);
  }
};