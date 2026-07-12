const chalk = require('chalk');
const packageJson = require('../../../package.json');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  lo - 项目概述'));
    console.log(chalk.gray(`  版本: ${packageJson.version}`));
    console.log(chalk.gray(`  ${packageJson.description}`));

    console.log(`
  lo 是一个本地优先的知识管理 CLI 工具。

  核心理念：
  - 数据自主：所有数据存储在本地磁盘，不依赖任何云端服务
  - 端到端加密：笔记内容在写入磁盘前加密，只有持有密钥的人能读取
  - 版本控制：类似 Git 的工作流（暂存区、提交历史）
  - SSH 认证：利用现存 SSH 密钥实现去中心化的身份验证
  - 零知识：私钥不离开设备，加密密钥不发送到任何服务器
  - AI 原生：内置 AI OS、智能体、自演化等 AI 能力
  - 可扩展：插件系统、事件总线、工作流引擎

  项目结构：
    src/commands/   → 命令处理器（CLI 入口）
    src/repo/       → 核心引擎（数据库、加密、版本控制）
    src/evolution/  → 自演化引擎（Phase 6.8）
    src/ai/         → AI OS 内核（Phase 6.7）
    src/collaboration/ → 多智能体协作（Phase 6.6）
    src/agent/      → 知识智能体（Phase 6.5）
    src/permission/ → 权限系统（Phase 6.4）
    src/workflow/   → 工作流引擎（Phase 6.3）
    src/event/      → 事件总线（Phase 6.2）
    src/plugin/     → 插件系统（Phase 6.1）
    src/graph/      → 知识图谱子系统
    src/utils/      → 工具库（加密、SSH 认证、哈希）
    bin/            → 入口脚本`);
};
