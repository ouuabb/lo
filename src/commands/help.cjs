const chalk = require('chalk');

module.exports = function help(argv) {
  console.log('\n' + chalk.bold('基础命令:'));
  console.log('  init          初始化资源仓库');
  console.log('  new           创建新资源（以 name/rid 标识，同名自动入栈）');
  console.log('  import        导入资源');
  console.log('  list           列出所有资源（资源视图，含容器/虚拟资源）');
  console.log('  files          列出可操作文件（文件视图，仅显示 resources/ 下文件）');
  console.log('  show          查看资源（支持 rid / name / path 三级查找）');
  console.log('  edit          编辑资源');
  console.log('  delete        删除资源');
  
  console.log('\n' + chalk.bold('版本控制:'));
  console.log('  add           添加文件到暂存区');
  console.log('  commit        提交暂存区（自动检测合并场景）');
  console.log('  reset         取消暂存');
  console.log('  diff          显示文件变更差异');
  console.log('  log           查看提交历史');
  console.log('  status        查看工作区状态');
  console.log('  rm            暂存文件删除');

  console.log('\n' + chalk.bold('远程同步:'));
  console.log('  remote        管理远程仓库别名');
  console.log('  push          推送变更到远程设备');
  console.log('  pull          从远程设备拉取变更');
  console.log('  clone         从远程仓库克隆');
  console.log('  serve         启动本地 HTTP API 服务');

  console.log('\n' + chalk.bold('资源管理:'));
  console.log('  create resource   创建容器资源（project/album/dataset 等）');
  console.log('  container      容器管理（promote/status/scan/sync/list/members/ignore 等）');
  console.log('  resource       资源导航（related/backlinks/impact）');
  console.log('  link          建立资源链接');
  console.log('  unlink        解除资源链接');
  console.log('  move          移动资源');
  console.log('  tag           管理标签');
  console.log('  category      管理分类');
  console.log('  sync          同步资源（含 [[wikilink]] 自动解析，无提交历史）');
  console.log('  stack         管理资源栈（同名冲突冗余副本，list/pop/drop）');

  console.log('\n' + chalk.bold('关系图与知识智能:'));
  console.log('  graph          资源关系图（neighbors/backlinks/path/cycles/export/analyze/query）');
  console.log('  relation       关系管理（add/remove/list/show）');
  console.log('  knowledge      知识智能（analyze/gaps/recommend/timeline/lifecycle/repair/ai/evolution）');
  console.log('  suggestion     AI 建议管理（list/approve/execute/reject）');
  console.log('  automation     知识自动化（run）');
  console.log('  federation     联邦仓库管理（list/add/remove）');

  console.log('\n' + chalk.bold('扩展系统（Phase 6.x）:'));
  console.log('  plugin         插件系统（list/enable/disable/reload/info）');
  console.log('  event          事件总线（list/history/listeners/replay）');
  console.log('  workflow       工作流引擎（list/run/status/history）');
  console.log('  permission     权限管理（role/check/grant/audit）');
  console.log('  agent          知识智能体（list/info/run/memory/messages/send）');
  console.log('  team           Agent 团队协作（list/run）');
  console.log('  ai             AI 原生知识 OS（status/ask/analyze/insights/memory）');
  console.log('  evolution      知识系统自演化（status/analyze/run/history）');
  
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
  console.log('  docs          查看功能详解（rid、stack、加密、认证等）');
  
  console.log('\n' + chalk.gray('使用 lo <command> --help 查看详细帮助'));
  console.log(chalk.gray('使用 lo manual 查看命令手册  |  lo docs 查看功能详解'));
  process.exit(0);
};
