const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  事件总线（Phase 6.2）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.bold.yellow('\n  一、概述'));
    console.log(`
  lo 事件总线基于发布-订阅（Pub/Sub）模式，是系统各组件之间
  松耦合通信的核心基础设施。所有资源变更、同步操作、插件事件
  等都通过事件总线广播。

  核心组件：
    - EventBus       — 事件发布与订阅
    - EventStore     — 事件持久化存储
    - MiddlewareChain — 中间件链，事件处理管道
    - EventRegistry  — 事件类型注册表`);

    console.log(chalk.bold.yellow('\n  二、事件类型'));
    console.log(`
  系统事件分为以下几个层级：

  资源层事件：
    resource:created   — 资源创建
    resource:updated   — 资源更新
    resource:deleted   — 资源删除
    resource:tagged    — 标签变更

  关系层事件：
    relation:created   — 关系建立
    relation:deleted   — 关系解除

  同步层事件：
    sync:before-push   — 推送前
    sync:after-push    — 推送后
    sync:before-pull   — 拉取前
    sync:after-pull    — 拉取后

  系统层事件：
    repo:opened        — 仓库打开
    repo:closing       — 仓库关闭
    plugin:loaded      — 插件加载
    plugin:unloaded    — 插件卸载`);

    console.log(chalk.bold.yellow('\n  三、中间件'));
    console.log(`
  事件处理管道支持中间件链，在事件到达订阅者之前进行预处理：

    事件发布
      │
      ▼
    中间件1 → 中间件2 → ... → 中间件N
      │
      ▼
    事件存储（持久化）
      │
      ▼
    订阅者回调

  内置中间件：
    - 日志中间件：记录所有事件
    - 限流中间件：防止高频事件风暴
    - 校验中间件：验证事件格式`);

    console.log(chalk.bold.yellow('\n  四、事件持久化'));
    console.log(`
  事件默认持久化到 SQLite events 表，支持：
    - 事件历史查询
    - 事件重放（replay）
    - 事件统计（按类型/来源聚合）

  持久化结构：
    events 表
    ├── id          事件唯一 ID
    ├── type        事件类型
    ├── payload     事件负载（JSON）
    ├── source      事件来源
    ├── timestamp   时间戳
    └── metadata    附加元数据`);

    console.log(chalk.gray('\n  相关命令：'));
    console.log(chalk.gray('    lo event list/history/listeners/replay'));
    console.log(chalk.gray('    lo plugin     — 插件系统'));
    console.log(chalk.gray('    lo manual event'));
    console.log('');
};
