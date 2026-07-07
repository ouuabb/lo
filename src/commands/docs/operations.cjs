const chalk = require('chalk');

module.exports = function() {
  console.log(chalk.bold.cyan('\n  操作追踪体系'));

  // 操作类型
  console.log(chalk.bold.yellow('\n  操作类型（OP_TYPES）'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  sync_ops 表定义了 5 种操作类型，用于跨设备同步的操作日志：

  ┌──────────────────────┬────────────────────┬──────────┐
  │ 类型                  │ 值                  │ 状态     │
  ├──────────────────────┼────────────────────┼──────────┤
  │ RESOURCE_CREATED     │ resource_created   │ 活跃     │
  │ RESOURCE_UPDATED     │ resource_updated   │ 活跃     │
  │ RESOURCE_DELETED     │ resource_deleted   │ 活跃     │
  │ RESOURCE_MOVED       │ resource_moved     │ 活跃     │
  │ RESOURCE_TAGGED      │ resource_tagged    │ 预留     │
  └──────────────────────┴────────────────────┴──────────┘

  RESOURCE_TAGGED 定义了处理逻辑但当前无任何代码触发，属于预留类型。`);

  // RESOURCE_CREATED
  console.log(chalk.bold.yellow('\n  RESOURCE_CREATED — 资源创建'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  触发场景:

    lo import <文件>           导入外部文件到仓库
    lo sync                    发现磁盘上的新文件
    lo commit                  提交暂存区 added 列表
    lo commit                  提交 modified 列表中的文件在 DB 中不存在时（降级为新增）
    FileWatcher add 事件       拖文件/外部程序写入文件时，chokidar 检测到文件新增
    Repository.importFile()    API 调用导入单个文件
    Repository.createResource() API 调用以编程方式创建资源
    lo pull                   从远程拉取的新建资源`);

  // RESOURCE_UPDATED
  console.log(chalk.bold.yellow('\n  RESOURCE_UPDATED — 资源更新'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  触发场景:

    lo edit <rid>              用编辑器修改资源，保存后自动触发
    lo sync                    检测到文件 mtime 变化且 hash 或元数据不同
    lo commit                  提交暂存区 modified 列表，hash 变更时
    lo commit                  提交暂存的元数据变更（tags、category 等）
    FileWatcher change 事件    外部程序修改了文件内容
    Repository.updateResource() API 调用更新资源`);

  // RESOURCE_DELETED
  console.log(chalk.bold.yellow('\n  RESOURCE_DELETED — 资源删除'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  触发场景:

    lo delete <rid>            软删除（默认）或硬删除（--hard）
    lo sync                    检测到磁盘文件消失，且 hash 未被重命名匹配
    lo commit                  提交暂存区 deleted 列表
    FileWatcher unlink 事件    文件被外部程序或用户手动删除
    Repository.deleteResource() API 调用删除资源`);

  // RESOURCE_MOVED
  console.log(chalk.bold.yellow('\n  RESOURCE_MOVED — 资源移动/重命名'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  触发场景:

    lo move <rid> <新路径>     显式移动/重命名资源
    lo sync                    通过 hash 匹配自动检测重命名
    lo commit                  提交暂存区 renamed 列表
    Repository.moveResource()   API 调用移动资源`);

  // 检测命令
  console.log(chalk.bold.yellow('\n  检测命令对比'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  ┌──────────────┬────────────────────┬────────────────────┬──────────────────┐
  │ 检测维度      │ lo status          │ lo diff            │ lo sync          │
  ├──────────────┼────────────────────┼────────────────────┼──────────────────┤
  │ 暂存 added   │ 分类列出           │ + 内容预览 (前5行)  │ —                │
  │ 暂存 modified│ 分类列出           │ + hash对比+元数据   │ —                │
  │ 暂存 deleted │ 分类列出           │ + title/type       │ —                │
  │ 暂存 renamed │ 分类列出           │ + 旧→新路径         │ —                │
  │ 暂存 metadata│ 分类列出           │ + 具体字段变化      │ —                │
  ├──────────────┼────────────────────┼────────────────────┼──────────────────┤
  │ 未暂存 mod   │ 分类列出           │ + hash 对比         │ 更新 DB+sync_ops │
  │ 未暂存 del   │ 分类列出           │ —                  │ 标记删除+sync_ops│
  │ 未暂存 rename│ hash匹配检测       │ —                  │ hash匹配+sync_ops│
  │ 未跟踪新文件  │ 列出              │ 标记"未跟踪"        │ 导入 DB+sync_ops │
  │ wikilink     │ —                  │ —                  │ 自动解析 [[]]    │
  └──────────────┴────────────────────┴────────────────────┴──────────────────┘

  status 和 diff 是只读检测，不修改任何数据。
  sync 是唯一能将"未暂存变更"直接写入 DB 和 sync_ops 的命令。`);

  // FileWatcher
  console.log(chalk.bold.yellow('\n  FileWatcher — chokidar 实时文件监控'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  lo 内置基于 chokidar 的文件监控器，可监听仓库目录的所有文件系统事件：

  ┌──────────────┬──────────────────────────────────────┐
  │ 事件         │ 自动响应                               │
  ├──────────────┼──────────────────────────────────────┤
  │ add          │ importFile() 自动导入到 DB            │
  │ change       │ rehash() 更新 hash                    │
  │ unlink       │ deleteResource() 软删除               │
  │ addDir       │ 通知回调                              │
  │ unlinkDir    │ 通知回调                              │
  └──────────────┴──────────────────────────────────────┘

  排除路径: .* 隐藏文件、node_modules、.repo、backups
  启动行为: ignoreInitial: true（不触发已有文件事件）

  重要: FileWatcher 的自动处理不会写入 sync_ops 操作日志。
  只有显式命令（lo sync、lo commit、lo edit 等）才会产生
  可跨设备同步的操作记录。`);

  // 暂存区
  console.log(chalk.bold.yellow('\n  暂存区（staging.json）'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  暂存区是 Git 风格的工作流中间层，存储于 .repo/staging.json：

    ┌──────────┬────────────────────────────────────┐
    │ 列表     │ 含义                                 │
    ├──────────┼────────────────────────────────────┤
    │ added    │ 新文件已被 lo add，尚未 commit       │
    │ modified │ 已入库文件修改后 lo add，尚未 commit  │
    │ deleted  │ lo rm 标记删除，尚未 commit          │
    │ renamed  │ 重命名操作已暂存，尚未 commit         │
    │ metadata │ 标签/分类等元数据变更，尚未 commit    │
    └──────────┴────────────────────────────────────┘

  lo commit 时清空暂存区，将变更写入 DB 和 sync_ops。`);

  // 数据流
  console.log(chalk.bold.yellow('\n  完整数据流'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  用户操作 / 拖文件 / chokidar 事件
      │
      ├─→ lo add/rm/mv/tag/category  ──→  staging.json
      │                                        │
      │                                   lo commit ──→ DB + sync_ops
      │
      ├─→ lo import / lo edit / lo sync  ──→  DB + sync_ops（直接写入）
      │
      ├─→ FileWatcher (chokidar)  ──→  DB 更新（不写 sync_ops）
      │
      ├─→ lo status  ──→  只读检测：暂存 + 未暂存 + 未跟踪
      ├─→ lo diff    ──→  只读检测：同上 + 内容差异详情
      │
      └─→ lo sync    ──→  全量检测 + 写入 sync_ops
           lo push   ──→  打包 sync_ops + 文件 → 远程
           lo pull   ──→  拉取 → applyOps 重放 → 本地 DB

  核心原则: 无论变更来源是什么（命令行、拖文件、外部编辑器、
  chokidar 事件），系统都能检测并响应。但只有经过 lo commit
  或 lo sync 的变更才会产生跨设备可同步的操作日志。`);

  // 注意事项
  console.log(chalk.bold.yellow('\n  注意事项'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  - lo status / lo diff 不修改任何数据，仅做检测报告
  - lo sync 是唯一能直接将磁盘变更写入 DB + sync_ops 的命令
  - FileWatcher 自动响应但不写 sync_ops（适合本地实时感知）
  - 跨设备同步依赖 sync_ops 表，建议定期 lo sync 或 lo commit
  - RESOURCE_TAGGED 类型已预留，待未来版本激活
  - push/pull/clone 通过 sync_ops 的增量锚点实现高效同步

  相关命令: lo status, lo diff, lo sync, lo commit
  相关文档: lo docs sync, lo docs database`);
  console.log('');
};
