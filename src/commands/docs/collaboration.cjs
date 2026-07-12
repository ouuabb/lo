const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  多智能体协作（Phase 6.6）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.bold.yellow('\n  一、概述'));
    console.log(`
  多智能体协作系统允许多个 Agent 组成团队，协同完成复杂的
  知识管理任务。团队中的 Agent 可以分工协作、共享信息和
  联合决策。

  核心组件：
    - CollaborationEngine — 协作引擎
    - TeamManager         — 团队管理
    - MessageBus          — 消息总线
    - TaskSystem          — 任务分配与跟踪
    - SharedMemory        — 团队共享记忆`);

    console.log(chalk.bold.yellow('\n  二、团队模型'));
    console.log(`
  团队结构：

    ┌─────────────────────────────────────────┐
    │  Team                                    │
    │  ├── Leader (Agent)                      │
    │  ├── Members (Agent[])                   │
    │  ├── SharedMemory                        │
    │  ├── TaskQueue                           │
    │  └── CollaborationRules                  │
    └─────────────────────────────────────────┘

  角色分工：
    - Leader:   负责任务分解、分配和协调
    - Member:   执行具体子任务，向 Leader 汇报

  协作模式：
    - 层级协作：Leader 分配任务，成员执行
    - 共识协作：成员共同讨论达成共识
    - 流水线：成员按顺序处理任务的不同阶段`);

    console.log(chalk.bold.yellow('\n  三、消息模型'));
    console.log(`
  团队内部消息传递：

  消息类型         说明
  ──────────────  ──────────────────────────────────
  task_assign      Leader 向成员分配任务
  task_report      成员向 Leader 汇报进度
  info_share       成员间共享信息
  help_request     成员请求帮助
  consensus_propose 共识提案
  consensus_vote   共识投票`);

    console.log(chalk.bold.yellow('\n  四、任务系统'));
    console.log(`
  团队任务的生命周期：

    created → assigned → in_progress → completed
                        ↘ blocked → retry
                        ↘ failed

  任务属性：
    - 优先级（high/medium/low）
    - 依赖关系（任务间依赖）
    - 截止时间
    - 所需能力（匹配 Agent 类型）`);

    console.log(chalk.bold.yellow('\n  五、共享记忆'));
    console.log(`
  团队共享记忆是团队成员共同维护的知识库：

  存储内容：
    - 团队决策记录
    - 成功经验（最佳实践）
    - 失败教训
    - 上下文信息（当前任务状态）

  与 Agent 个人记忆隔离：
    - 共享记忆：团队所有成员可读写
    - 个人记忆：仅 Agent 自己可访问`);

    console.log(chalk.gray('\n  相关命令：'));
    console.log(chalk.gray('    lo team list/run'));
    console.log(chalk.gray('    lo agent       — 单个 Agent 管理'));
    console.log(chalk.gray('    lo manual team'));
    console.log('');
};
