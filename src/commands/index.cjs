const Logger = require('../utils/logger.cjs');
const Indexer = require('../core/indexer.cjs');

module.exports = async function index() {
  try {
    Logger.info('正在生成索引...');
    const indexer = new Indexer();
    const indexPath = await indexer.generate();
    Logger.success(`✅ 索引已生成: ${indexPath}`);
    
  } catch (error) {
    Logger.error(`生成索引失败: ${error.message}`);
    process.exit(1);
  }
};