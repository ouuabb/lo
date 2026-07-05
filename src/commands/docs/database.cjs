const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  数据库与资源索引'));
    console.log(`
  lo 使用 SQLite 作为本地数据库。

  ┌──────────────┬──────────────────────────┐
  │  表名        │  用途                     │
  ├──────────────┼──────────────────────────┤
  │  resources   │  资源元数据（RID、路径、   │
  │              │  哈希、类型、加密状态等）  │
  │  relations   │  资源间的双向链接关系     │
  │              │  (lo link / lo unlink)      │
  │  commits     │  提交历史记录             │
  │  sync_config │  配置键值对（认证设置）    │
  │  sync_log    │  同步操作日志             │
  └──────────────┴──────────────────────────┘

  resources 表核心字段：
    rid         唯一标识符（res_xxx 格式）
    type        类型（note, image, pdf 等）
    path        文件系统路径
    hash        明文 SHA-256 散列（变更检测）
    metadata    JSON 元数据（标题、字数等）
    encrypted   加密状态（0=明文, 1=已加密）
    deleted     软删除标记

  散列的用途：
  - 变更检测：比较文件当前散列与 DB 记录
  - 去重检测：通过散列判断文件是否已导入
  - DB 中存储明文散列，不暴露文件内容

  加密感知：
  - 加密文件先解密再散列
  - DB 始终存储明文 SHA-256
  - 相同内容多次加密 → 相同散列 → 正确检测不变更`);
};
