const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  联邦知识图谱（Phase 5.10）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.bold.yellow('\n  一、概述'));
    console.log(`
  lo 联邦知识图谱系统允许跨多个独立仓库进行统一的图查询和
  资源同步。每个仓库保持独立性，同时可以加入联邦以实现
  跨仓库的知识关联。

  核心组件：
    - GlobalRID         — 全局资源标识符
    - FederationManager — 联邦仓库管理器
    - FederatedGraph    — 联邦图查询引擎
    - SyncEngine        — 联邦同步引擎
    - ConflictResolver  — 冲突解决器`);

    console.log(chalk.bold.yellow('\n  二、GlobalRID'));
    console.log(`
  全局资源标识符（GlobalRID）是联邦系统的基石：

  格式: namespace:local_rid
  示例:
    personal:res_abc123         # 个人知识库中的笔记
    work:res_def456             # 工作知识库中的文档
    shared:res_ghi789           # 共享知识库中的资源

  命名空间管理：
    lo federation add /path/to/work --namespace work --name "工作笔记"
    lo federation remove work
    lo federation list`);

    console.log(chalk.bold.yellow('\n  三、联邦图查询'));
    console.log(`
  跨仓库的图查询能力：

    lo graph query-federated personal:res_abc --depth 3

  查询能力：
    - 邻居查询：查找跨仓库的关联资源
    - 路径查询：发现跨仓库的知识路径
    - 影响分析：评估跨仓库的变更影响

  数据隔离：
    - 查询结果标注命名空间来源
    - 不修改远程仓库数据
    - 本地缓存远程索引`);

    console.log(chalk.bold.yellow('\n  四、联邦同步'));
    console.log(`
  联邦仓库间的资源同步：

    lo sync pull <namespace>    从远程仓库拉取资源
    lo sync push <namespace>    推送本地资源到远程
    lo sync status              查看同步状态
    lo sync conflict list       列出冲突
    lo sync conflict resolve    解决冲突

  同步策略：
    - 增量同步：只传输变更
    - 选择性同步：按命名空间过滤
    - 冲突解决：local-win / remote-win / manual`);

    console.log(chalk.bold.yellow('\n  五、冲突管理'));
    console.log(`
  联邦同步中的冲突处理：

  冲突类型       说明              解决方式
  ────────────  ────────────────  ──────────────
  content       两边都修改了内容   选择本地/远程
  metadata      元数据冲突         合并或选择
  relation      关系冲突           保留双向
  delete-edit   删除 vs 编辑       用户决定

  CLI 冲突管理：
    lo sync conflict list
    lo sync conflict resolve <id> local-win
    lo sync conflict resolve <id> remote-win
    lo sync conflict resolve <id> manual`);

    console.log(chalk.gray('\n  相关命令：'));
    console.log(chalk.gray('    lo federation list/add/remove'));
    console.log(chalk.gray('    lo graph query-federated'));
    console.log(chalk.gray('    lo sync pull/push/status/conflict'));
    console.log(chalk.gray('    lo docs knowledge'));
    console.log(chalk.gray('    lo manual federation'));
    console.log('');
};
