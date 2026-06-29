const chalk = require('chalk');
const Logger = require('../utils/logger.cjs');
const SearchEngine = require('../core/search.cjs');

module.exports = function find(argv) {
  const { query, limit, type } = argv;
  
  try {
    const search = new SearchEngine();
    let results = [];
    
    if (type === 'tag') {
      results = search.searchByTag(query);
    } else {
      results = search.search(query, { limit: limit || 10 });
    }
    
    if (results.length === 0) {
      Logger.info('未找到匹配的笔记');
      return;
    }
    
    Logger.title(`搜索结果: "${query}" (共 ${results.length} 条)`);
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${chalk.bold(result.title)}`);
      console.log(`   ${chalk.gray(result.path)}`);
      console.log(`   创建时间: ${result.created}`);
      if (result.tags && result.tags.length > 0) {
        console.log(`   标签: ${result.tags.map(t => `#${t}`).join(' ')}`);
      }
      console.log();
    });
    
  } catch (error) {
    Logger.error(`搜索失败: ${error.message}`);
    process.exit(1);
  }
};