const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

module.exports = async function sync(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open();

    Logger.info('正在同步资源...');
    const count = await repo.sync();
    
    Logger.success(`同步完成，共处理 ${count} 个资源`);
    
    await repo.close();

  } catch (error) {
    Logger.error(`同步失败: ${error.message}`);
    process.exit(1);
  }
};