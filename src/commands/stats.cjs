const chalk = require('chalk');
const Logger = require('../utils/logger.cjs');
const Scanner = require('../core/scanner.cjs');
const DateUtils = require('../utils/date.cjs');

module.exports = function stats(argv) {
  const { today, week } = argv;
  
  try {
    const scanner = new Scanner();
    const stats = scanner.getStats();
    
    Logger.title('知识库统计');
    
    console.log(chalk.blue('📝 笔记统计:'));
    console.log(`   总笔记数: ${stats.total}`);
    console.log(`   活跃笔记: ${stats.active}`);
    
    console.log('\n' + chalk.blue('✏️ 内容统计:'));
    console.log(`   总字数: ${stats.totalWords}`);
    
    console.log('\n' + chalk.blue('🏷️ 标签统计:'));
    console.log(`   总标签数: ${Object.keys(stats.tags).length}`);
    const topTags = Object.entries(stats.tags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    topTags.forEach(([tag, count]) => {
      console.log(`   #${tag}: ${count} 篇`);
    });
    
    console.log('\n' + chalk.blue('📊 状态统计:'));
    Object.entries(stats.statuses).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} 篇`);
    });
    
  } catch (error) {
    Logger.error(`获取统计信息失败: ${error.message}`);
    process.exit(1);
  }
};