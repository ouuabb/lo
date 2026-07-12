const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  知识智能体（Phase 6.5）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.bold.yellow('\n  一、概述'));
    console.log(`
  Knowledge Agent 是 lo 中的自治智能体，具备独立的状态机、
  记忆系统和规划/执行/反思循环，能够自主完成知识管理任务。

  核心组件：
    - AgentEngine     — Agent 引擎
    - AgentPlanner    — 任务规划器
    - AgentExecutor   — 任务执行器
    - AgentMemory     — 记忆系统
    - AgentStateMachine — 状态机`);

    console.log(chalk.bold.yellow('\n  二、Agent 类型'));
    console.log(`
  预定义 Agent 类型：

  类型          说明
  ────────────  ──────────────────────────────────
  researcher    研究员：探索知识关联、发现新知
  curator        策展人：整理分类、优化标签
  analyst        分析师：统计分析、生成报告
  monitor        监控员：监控知识库健康状态
  assistant      助手：回答知识相关问题

  每种 Agent 类型有独特的：
    - 状态机（idle → planning → executing → reflecting）
    - 记忆结构（短期/长期/工作记忆）
    - 工具集（可调用的操作）`);

    console.log(chalk.bold.yellow('\n  三、状态机'));
    console.log(`
  每个 Agent 遵循以下状态机：

    idle ──→ planning ──→ executing ──→ reflecting
      ↑                                      │
      └────────────────────────────────────┘

  1. idle:        等待任务或事件触发
  2. planning:    分析目标，制定执行计划
  3. executing:   按计划逐步执行操作
  4. reflecting:  评估结果，更新记忆，决定下一步`);

    console.log(chalk.bold.yellow('\n  四、记忆系统'));
    console.log(`
  Agent 记忆分为三层：

  记忆层       容量      持久化    用途
  ──────────  ────────  ────────  ──────────────────
  工作记忆    小（5-7条） 否        当前任务上下文
  短期记忆    中（100条）  是        近期经验
  长期记忆    大（无限制） 是        历史知识和模式

  记忆类型：
    - episodic    情景记忆（具体事件）
    - semantic    语义记忆（概念和关系）
    - procedural  程序记忆（操作流程）`);

    console.log(chalk.bold.yellow('\n  五、Agent 间通信'));
    console.log(`
  Agent 之间通过消息系统通信：

    lo agent send <from> <to> <message>

  消息支持：
    - 点对点消息（Agent → Agent）
    - 广播消息（Agent → 所有）
    - 任务委派（Agent → Agent + 任务）`);

    console.log(chalk.gray('\n  相关命令：'));
    console.log(chalk.gray('    lo agent list/info/run/memory/messages/send'));
    console.log(chalk.gray('    lo team list/run  — Agent 团队协作'));
    console.log(chalk.gray('    lo manual agent'));
    console.log('');
};
