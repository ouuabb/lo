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
 *   soft-delete  软删除与关联数据残留
 *   stack        资源栈机制（同名冲突自动冗余）
 *   rid          RID 一等公民机制
 *   operations   操作追踪体系（所有可监听的操作类型与触发来源）
 *   resource-container  Resource 容器模型
 *   plugin        插件系统（生命周期/扩展点/上下文隔离）
 *   event         事件总线（发布-订阅/中间件/持久化）
 *   workflow      工作流引擎（步骤模型/条件引擎/调度器）
 *   permission    权限系统（RBAC+ABAC/角色/ACL/审计）
 *   agent         知识智能体（类型/状态机/记忆/规划执行）
 *   collaboration 多智能体协作（消息/团队/任务/共享记忆）
 *   ai-os         AI 原生知识 OS（推理引擎/语义记忆/学习）
 *   evolution     知识系统自演化（OODA 循环/健康分析/进化）
 *   knowledge     知识智能分析（图谱/缺口/推荐/模式/演化）
 *   federation    联邦知识图谱（GlobalRID/跨仓库同步）
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
  wikilink: require('./wikilink.cjs'),
  'soft-delete': require('./soft-delete.cjs'),
  stack: require('./stack.cjs'),
  rid: require('./rid.cjs'),
  operations: require('./operations.cjs'),
  'resource-container': require('./resource-container.cjs'),
  plugin: require('./plugin.cjs'),
  event: require('./event.cjs'),
  workflow: require('./workflow.cjs'),
  permission: require('./permission.cjs'),
  agent: require('./agent.cjs'),
  collaboration: require('./collaboration.cjs'),
  'ai-os': require('./ai-os.cjs'),
  evolution: require('./evolution.cjs'),
  knowledge: require('./knowledge.cjs'),
  federation: require('./federation.cjs')
};

const TOPIC_ALIASES = {
  overview: 'overview',
  notes: 'notes',
  note: 'notes',
  concepts: 'concepts',
  concept: 'concepts',
  philosophy: 'concepts',
  design: 'concepts',
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
  backlink: 'wikilink',
  'soft-delete': 'soft-delete',
  softdelete: 'soft-delete',
  soft: 'soft-delete',
  delete: 'soft-delete',
  orphan: 'soft-delete',
  relations: 'soft-delete',
  stack: 'stack',
  stacks: 'stack',
  layer: 'stack',
  rid: 'rid',
  uid: 'rid',
  id: 'rid',
  identifier: 'rid',
  operations: 'operations',
  ops: 'operations',
  tracking: 'operations',
  events: 'operations',
  watcher: 'operations',
  monitor: 'operations',
  'resource-container': 'resource-container',
  container: 'resource-container',
  member: 'resource-container',
  promote: 'resource-container',
  resource: 'resource-container',
  capability: 'resource-container',
  plugin: 'plugin',
  plugins: 'plugin',
  extension: 'plugin',
  event: 'event',
  events: 'event',
  eventbus: 'event',
  pubsub: 'event',
  workflow: 'workflow',
  wf: 'workflow',
  automation: 'workflow',
  permission: 'permission',
  perm: 'permission',
  rbac: 'permission',
  role: 'permission',
  acl: 'permission',
  audit: 'permission',
  agent: 'agent',
  agents: 'agent',
  bot: 'agent',
  collaboration: 'collaboration',
  collab: 'collaboration',
  team: 'collaboration',
  multiagent: 'collaboration',
  'ai-os': 'ai-os',
  aios: 'ai-os',
  ai: 'ai-os',
  reasoning: 'ai-os',
  semantic: 'ai-os',
  evolution: 'evolution',
  evolve: 'evolution',
  ooda: 'evolution',
  selfimprove: 'evolution',
  knowledge: 'knowledge',
  kg: 'knowledge',
  graph: 'knowledge',
  gaps: 'knowledge',
  patterns: 'knowledge',
  federation: 'federation',
  federated: 'federation',
  globalrid: 'federation',
  crossrepo: 'federation'
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
    { id: 'soft-delete', name: '软删除与关联数据残留', desc: '资源软删除后 relations 的行为、API 差异、可视化影响、设计理由' },
    { id: 'stack',       name: '资源栈机制',       desc: '同名资源冲突自动冗余、layer 逻辑分层、stack 命令操作' },
    { id: 'rid',         name: 'RID 一等公民',       desc: 'RID 唯一标识、三级查找机制、name 与 RID 的关系' },
    { id: 'operations',  name: '操作追踪体系',       desc: 'OP_TYPES 详解、status/diff/sync 对比、FileWatcher、数据流' },
    { id: 'resource-container', name: 'Resource 容器模型', desc: 'Resource/Container/Member 模型、Content Source、Promote 机制' },
    { id: 'plugin',      name: '插件系统 (Phase 6.1)',     desc: '插件生命周期管理、扩展点注册、上下文隔离、模块协议' },
    { id: 'event',       name: '事件总线 (Phase 6.2)',     desc: '发布-订阅模式、中间件链、事件持久化、监听器管理' },
    { id: 'workflow',    name: '工作流引擎 (Phase 6.3)',    desc: '步骤模型、条件引擎、调度器、执行历史' },
    { id: 'permission',  name: '权限系统 (Phase 6.4)',     desc: 'RBAC+ABAC 混合模型、资源级 ACL、审计日志' },
    { id: 'agent',       name: '知识智能体 (Phase 6.5)',    desc: 'Agent 类型与状态机、记忆系统、规划/执行/反思循环' },
    { id: 'collaboration', name: '多智能体协作 (Phase 6.6)', desc: '消息模型、团队管理、任务系统、共享记忆' },
    { id: 'ai-os',       name: 'AI 原生知识 OS (Phase 6.7)', desc: '推理引擎、语义/概念记忆、学习引擎、AI 请求响应模型' },
    { id: 'evolution',   name: '知识系统自演化 (Phase 6.8)',  desc: 'OODA 循环、健康分析、进化检测、策略生成、执行验证' },
    { id: 'knowledge',   name: '知识智能分析 (Phase 5.7~5.11)', desc: '知识图谱分析、缺口检测、智能推荐、模式检测、演化分析' },
    { id: 'federation',  name: '联邦知识图谱 (Phase 5.10)', desc: 'GlobalRID、跨仓库同步、联邦图查询、冲突管理' },
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
