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
  
  console.log('\n' + chalk.bold('版本控制:'));
  console.log('  add           添加文件到暂存区');
  console.log('  commit        提交暂存区');
  console.log('  reset         取消暂存');
  console.log('  log           查看提交历史');
  console.log('  status        查看工作区状态');

  console.log('\n' + chalk.bold('远程同步:'));
  console.log('  remote        管理远程仓库别名');
  console.log('  push          推送变更到远程设备');
  console.log('  pull          从远程设备拉取变更');
  console.log('  clone         从远程仓库克隆');

  console.log('\n' + chalk.bold('资源管理:'));
  console.log('  link          建立资源链接');
  console.log('  move          移动资源');
  console.log('  tag           管理标签');
  console.log('  sync          同步资源');
  
  console.log('\n' + chalk.bold('搜索与查询:'));
  console.log('  find          搜索资源');
  console.log('  stats         显示统计信息');
  console.log('  index         生成索引');
  
  console.log('\n' + chalk.bold('安全:'));
  console.log('  auth          管理 SSH 身份认证');
  
  console.log('\n' + chalk.bold('其他:'));
  console.log('  daily         创建今日日记');
  console.log('  backup        备份资源仓库');
  console.log('  config        管理配置');
  console.log('  help          查看帮助');
  console.log('  manual        查看命令手册');
  console.log('  docs          查看功能详解');
  
  console.log('\n' + chalk.gray('使用 lo <command> --help 查看详细帮助'));
  console.log(chalk.gray('使用 lo manual 查看命令手册  |  lo docs 查看功能详解'));
};
