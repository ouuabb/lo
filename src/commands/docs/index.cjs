const chalk = require('chalk');
const packageJson = require('../../../package.json');

/**
 * lo docs — 项目功能详解
 *
 * 用法:
 *   lo docs                 显示所有主题概览
 *   lo docs <topic>         显示指定主题的详细说明
 *
 * 主题:
 *   overview      项目概述
 *   notes         笔记详解（什么是笔记、文件格式、元数据、CRUD、模板、标签分类、版本控制）
 *   concepts      核心设计观念
 *   architecture  架构分析（数据存储、类关系、扩展点、承载量、模块系统设计）
 *   encryption    端到端加密系统
 *   auth          SSH 身份认证系统
 *   version      版本控制系统
 *   database     数据库与资源索引
 *   security     安全设计摘要
 *   sync         远程同步系统
 *   serve        本地 HTTP API 服务
 *   deploy       仓库部署与远程推送
 *   wikilink     [[wikilink]] 双向链接
 *   quickstart   快速上手指南
 */

const SECTIONS = {
  overview: require('./overview.cjs'),
  notes: require('./notes.cjs'),
  concepts: require('./concepts.cjs'),
  architecture: require('./architecture.cjs'),
  encryption: require('./encryption.cjs'),
  auth: require('./auth.cjs'),
  version: require('./version.cjs'),
  database: require('./database.cjs'),
  security: require('./security.cjs'),
  sync: require('./sync.cjs'),
  serve: require('./serve.cjs'),
  deploy: require('./deploy.cjs'),
  quickstart: require('./quickstart.cjs'),
  wikilink: require('./wikilink.cjs')
};

const TOPIC_ALIASES = {
  overview: 'overview',
  notes: 'notes',
  note: 'notes',
  concepts: 'concepts',
  concept: 'concepts',
  philosophy: 'concepts',
  design: 'concepts',
  rid: 'concepts',
  resource: 'concepts',
  architecture: 'architecture',
  arch: 'architecture',
  architecture: 'architecture',
  encryption: 'encryption',
  encrypt: 'encryption',
  e2ee: 'encryption',
  auth: 'auth',
  ssh: 'auth',
  version: 'version',
  vc: 'version',
  database: 'database',
  db: 'database',
  security: 'security',
  safe: 'security',
  sync: 'sync',
  remote: 'sync',
  serve: 'serve',
  api: 'serve',
  deploy: 'deploy',
  push: 'deploy',
  pull: 'deploy',
  clone: 'deploy',
  deployment: 'deploy',
  quickstart: 'quickstart',
  start: 'quickstart',
  guide: 'quickstart',
  wikilink: 'wikilink',
  wiki: 'wikilink',
  links: 'wikilink',
  link: 'wikilink',
  backlinks: 'wikilink',
  backlink: 'wikilink'
};

function printIndex() {
  console.log(chalk.bold.cyan('\n  lo - 项目功能详解'));
  console.log(chalk.gray(`  版本: ${packageJson.version}  |  ${packageJson.description}`));
  console.log(chalk.gray('  用法: lo docs <topic>    查看指定主题'));
  console.log(chalk.gray('  用法: lo docs             显示本索引'));

  const topics = [
    { id: 'overview',    name: '项目概述',       desc: '核心理念、数据自主、零知识架构' },
    { id: 'notes',       name: '笔记详解',       desc: '什么是笔记、文件格式、元数据、CRUD、模板、标签分类、版本控制' },
    { id: 'concepts',    name: '核心设计观念',   desc: '资源平等、RID 独立性、不可变实体' },
    { id: 'architecture',name: '架构分析',       desc: '数据存储层、类关系、扩展点、承载量、模块系统设计' },
    { id: 'encryption',  name: '端到端加密系统',  desc: 'AES-256-GCM、LOEC格式、密钥分层、HKDF、完整机制、同步中的加密' },
    { id: 'auth',        name: 'SSH 身份认证',    desc: '挑战-应答协议、多设备支持、会话缓存' },
    { id: 'version',     name: '版本控制系统',    desc: '暂存区、提交历史、状态检测' },
    { id: 'database',    name: '数据库与索引',    desc: 'SQLite 表结构、明文散列、加密感知' },
    { id: 'security',    name: '安全设计摘要',    desc: '9 项安全措施一览' },
    { id: 'sync',       name: '远程同步系统',    desc: '多设备同步、操作日志、冲突处理' },
    { id: 'serve',      name: '本地 HTTP API',   desc: 'lo serve、REST接口、SSH认证、外部集成' },
    { id: 'deploy',     name: '部署与推送',       desc: '服务器部署、SSH配置、push/pull/clone、API推送、自动化' },
    { id: 'wikilink',   name: '[[wikilink]] 双向链接', desc: '笔记间双向引用、别名语法、与 sync 的协作、数据模型' },
    { id: 'quickstart',  name: '快速上手指南',    desc: '从 init 到 backup 的完整命令序列' }
  ];

  console.log('');
  for (const t of topics) {
    console.log('  ' + chalk.yellow(('lo docs ' + t.id).padEnd(22)) + chalk.gray(t.desc));
  }
  console.log('');
}

module.exports = function docs(argv) {
  const topic = (argv && argv.topic) || (argv && argv._ && argv._[1]);
  const resolved = TOPIC_ALIASES[topic] || null;

  if (!resolved) {
    if (topic) {
      console.log(chalk.red(`\n  未找到主题: ${topic}`));
      console.log(chalk.gray('  运行 lo docs 查看所有可用主题'));
      process.exit(0);
    }
    printIndex();
    process.exit(0);
  }

  SECTIONS[resolved]();
  process.exit(0);
};
