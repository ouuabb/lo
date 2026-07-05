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

  项目结构：
    src/commands/   → 命令处理器（CLI 入口）
    src/repo/       → 核心引擎（数据库、加密、版本控制）
    src/utils/      → 工具库（加密、SSH 认证、哈希）
    bin/            → 入口脚本`);
};
