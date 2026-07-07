const chalk = require('chalk');

module.exports = function() {
  console.log(chalk.bold.cyan('\n  资源栈机制'));

  // 概述
  console.log(chalk.bold.yellow('\n  什么是资源栈'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  资源栈是 lo 处理同名资源冲突的自动冗余机制。

  当两个资源具有相同的逻辑名称（name）时，后来的资源不会覆盖前者，
  也不会被拒绝，而是自动进入"栈"——一个与该名称关联的层级列表。

  栈最多支持 20 层（layer 0~19），layer 0 为活跃层（日常使用），
  layer 1~19 为栈层（冗余备份）。`);

  // 为什么需要栈
  console.log(chalk.bold.yellow('\n  为什么需要栈'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  场景一：重复编辑

    lo new "周报"    → 文件: 2026-07-01-周报-a1b2c3d4.md → 活跃 (layer 0)
    lo new "周报"    → 文件: 2026-07-01-周报-e5f6g7h8.md → 入栈 (layer 1)

    两份周报都不会丢失。活跃的始终可用，旧的被保护在栈中。

  场景二：拖文件进仓库

    直接复制 周报.md 到 resources/ 目录，运行 lo sync：
    
    lo sync → 检测到同名冲突 → 自动入栈 layer 2

    无需手动干预，系统自动处理冗余。

  场景三：多设备同步冲突

    设备 A 创建"笔记A"，设备 B 也创建同名"笔记A"。
    pull 时应用远程操作 → 本地已有同名活跃资源 → 远程版本入栈。
    两份数据都保留，用户通过 lo stack pop 选择使用哪个版本。`);

  // layer 字段
  console.log(chalk.bold.yellow('\n  layer 字段'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  栈通过 resources 表的 layer 列实现（INTEGER NOT NULL DEFAULT 0）。

  ┌───────┬─────────────────────────────────────┐
  │ layer │ 含义                                 │
  ├───────┼─────────────────────────────────────┤
  │   0   │ 活跃层。所有日常操作默认操作该层。    │
  │ 1~19  │ 栈层。冗余备份，用户不可直接感知。    │
  └───────┴─────────────────────────────────────┘

  UNIQUE 约束: (name, layer)，保证同一名称的每个层号唯一。

  重要: 栈是逻辑概念，不是物理文件夹。所有栈层对应的文件都存在于
  resources/ 目录下，与活跃层文件完全一样。lo 通过 layer 字段
  区分它们，文件系统层面无任何区别。`);

  // 自动入栈流程
  console.log(chalk.bold.yellow('\n  自动入栈流程'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  所有入库路径（lo new + commit、lo sync、拖文件 + 文件监控）都经过
  resourceService.create()，在该方法中统一处理同名冲突：

    1. 推导资源逻辑 name（从文件路径中去掉日期前缀和随机后缀）
    2. getByName(name) 查询是否有活跃层已存在
    3. 若无冲突 → layer = 0（正常创建）
    4. 若有冲突 → 扫描当前栈，找下一个空闲 layer (1~19)
    5. layer 已满 (>=20) → 抛出异常，提示 lo stack drop

  这意味着：不存在任何可以"绕过"自动入栈的入库路径。`);

  // 栈命令
  console.log(chalk.bold.yellow('\n  栈命令'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  lo stack list
      列出所有栈中资源（layer >= 1），按 name 分组显示。
      每组展示活跃层（layer=0）和所有栈层（layer>=1）。

  lo stack pop <name>
      弹出栈顶（最小 layer>0），提升为 layer=0（活跃层）。
      原活跃层被压入栈（交换到原栈顶位置）。
      
      三步交换过程（避免 UNIQUE 约束冲突）：
        1. 活跃层 → layer=-1（临时释放 layer=0）
        2. 栈顶   → layer=0
        3. 旧活跃 → 原栈顶层号

  lo stack drop <name> <layer>
      硬删除指定栈层（从 resources 和 relations 表中移除）。
      不可恢复。不能删除 layer=0（活跃层）。

  禁止直接操作文件系统管理栈，所有栈操作必须通过 lo stack 命令。`);

  // 设计意图
  console.log(chalk.bold.yellow('\n  设计意图'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  - 零数据丢失: 同名冲突不覆盖、不拒绝，全部保留
  - 透明性: 日常使用完全不受栈影响（getByName 只查 layer=0）
  - 可管理性: 用户随时通过命令查看、切换、丢弃栈层
  - 文件系统不变: 不需要新文件夹结构，layer 是纯逻辑字段
  - 防误操作: 禁止直接文件系统操作栈，强制走命令路径`);

  // 注意事项
  console.log(chalk.bold.yellow('\n  注意事项'));
  console.log(chalk.gray('  ' + '─'.repeat(55)));
  console.log(`
  - 栈中文件也是正常文件，可被其他工具直接编辑
  - 栈层被 drop 后文件仍在磁盘上（需手动删除）
  - pop 后新活跃层与原活跃层的文件都保留在磁盘上
  - 跨设备同步时 layer 字段包含在 sync_op 数据中
  - 栈中资源按 name 查找不返回，需使用 rid 精确访问

  相关命令: lo stack, lo manual stack
  相关文档: lo docs rid`);
  console.log('');
};
