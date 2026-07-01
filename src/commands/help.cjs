const chalk = require('chalk');

module.exports = function help(argv) {
  console.log(chalk.bold.cyan('\nlo - 资源仓库 CLI'));
  console.log(chalk.gray('='.repeat(40)));
  
  console.log('\n' + chalk.bold('基础命令:'));
  console.log('  init          初始化资源仓库');
  console.log('  new           创建新资源');
  console.log('  import        导入资源');
  console.log('  list          列出所有资源');
  console.log('  show          查看资源');
  console.log('  edit          编辑资源');
  console.log('  delete        删除资源');
  
  console.log('\n' + chalk.bold('资源管理:'));
  console.log('  link          建立资源链接');
  console.log('  unlink        移除资源链接');
  console.log('  move          移动资源');
  console.log('  tag           管理标签');
  console.log('  sync          同步资源');
  
  console.log('\n' + chalk.bold('搜索与查询:'));
  console.log('  find          搜索资源');
  console.log('  stats         显示统计信息');
  console.log('  index         生成索引');
  
  console.log('\n' + chalk.bold('其他:'));
  console.log('  daily         创建今日日记');
  console.log('  backup        备份资源仓库');
  console.log('  config        管理配置');
  console.log('  manual        查看完整手册');
  
  console.log('\n' + chalk.gray('使用 lo <command> --help 查看详细帮助'));
};