const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  [[wikilink]] — 双向链接系统'));

    // Overview
    console.log(chalk.bold.yellow('\n  什么是 Wikilink'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  Wikilink 是 lo 的笔记间双向链接机制。在 .md 文件中使用 [[...]]
  语法即可创建链接，无需手动执行 lo link 命令。

  基本语法:
    [[res_xxx]]              按 RID 精确链接（推荐，唯一无歧义）
    [[笔记标题]]              按标题匹配链接（标题重复时可能匹配到非预期目标）
    [[res_xxx|显示别名]]      按 RID 链接，渲染时显示别名
    [[笔记标题|显示别名]]      按标题链接，渲染时显示别名

  推荐使用 RID 语法:
    - RID 是资源的唯一标识（res_ 前缀 + 12 位十六进制），永远不会冲突
    - 笔记标题可变，但 RID 在资源的整个生命周期中保持不变
    - 渲染层应展示标题（从 RID 查出 metadata.title 并显示），而非裸 RID

  简单示例:

    笔记A.md 内容:                笔记B.md 内容:
    # 笔记A                        # 笔记B
    参考 [[res_bbb]] 的思路。      来自 [[res_aaa|小A]] 的启发。

  运行 lo sync 后，A 和 B 之间建立了双向链接关系：
    - A → B (wikilink)
    - B → A (反向链接，自动维护)

  lo 自动完成了以下工作:
    1. 解析 [[...]] 语法，提取链接目标名称
    2. 按优先级匹配: RID 直接查询 → 标题匹配 → 文件名匹配
    3. 匹配成功后写入数据库的 relations 表（存储的是 RID 关系）
    4. 同时创建反向链接（被链接方也获得指向源头的链接）
    5. 源文件删除链接语法后，重新 sync 自动清理旧关系`);

    // How it works
    console.log(chalk.bold.yellow('\n  工作原理'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  从 Markdown 到数据库的完整流程:

  ┌──────────────────────────────────────────────────────────────┐
  │  1. 写入 [[...]] 语法                                        │
  │     A.md 内容: "# 笔记A\\n\\n参考 [[res_bbb]] 和 [[笔记C]]。"    │
  └──────────────────────┬───────────────────────────────────────┘
                         │  lo sync
                         ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  2. 正则解析                                                  │
  │     正则: /\\[\\[([^\\]|#]+?)(?:\\|(.+?))?\\]\\]/g               │
  │     提取出两个目标: ["res_bbb", "笔记C"]                         │
  └──────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  3. 三级匹配（优先级递减）                                     │
  │     ① res_bbb → RID 直接查询 resources 表 → rid_B（精确命中） │
  │     ② "笔记C" → 遍历所有笔记按 metadata.title 匹配 → rid_C    │
  │     ③ 仍未匹配 → 按文件名路径兜底匹配                          │
  │     未匹配的目标被静默忽略（不报错）                            │
  └──────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  4. 写入 relations 表                                         │
  │     DELETE 旧 wikilink (from_rid=A)                           │
  │     INSERT (from_rid=A, to_rid=rid_B, type='wikilink')       │
  │     INSERT (from_rid=A, to_rid=rid_C, type='wikilink')       │
  │     INSERT (from_rid=rid_B, to_rid=A, type='wikilink')  ← 反向│
  │     INSERT (from_rid=rid_C, to_rid=A, type='wikilink')  ← 反向│
  └──────────────────────────────────────────────────────────────┘

  关键设计决策:

  ┌──────────────────────────────────────────────────────────────┐
  │  决策             │  说明                                     │
  ├──────────────────┼───────────────────────────────────────────┤
  │  每次 sync 全量   │  每次解析时 DELETE 旧的 wikilink 再       │
  │  替换             │  INSERT 新的，保证与文件内容严格一致       │
  │                   │                                          │
  │  仅 .md 文件      │  只有 Markdown 文件参与 wikilink 解析；   │
  │                   │  图片、PDF 等不参与（用 lo link 手动链接） │
  │                   │                                          │
  │  按 RID 优先匹配  │  链接目标若以 res_ 开头，直接通过 RID 查询，   │
  │                   │  保证唯一性；否则按标题 → 文件名优先级匹配   │
  │                   │                                          │
  │  区分大小写       │  标题匹配是精确的（区分大小写）；RID 匹配    │
  │                   │  则不涉及大小写问题                          │
  │                   │                                          │
  │  静默忽略         │  链接到不存在的标题时，不报错、不警告，    │
  │                   │  类似许多 wiki 软件的行为                  │
  │                   │                                          │
  │  基于 RID 存储    │  wikilink 关系用 RID 标识，文件重命名或    │
  │                   │  移动不影响链接关系                        │
  └──────────────────────────────────────────────────────────────┘`);

    // Alias syntax
    console.log(chalk.bold.yellow('\n  别名语法'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  语法: [[真实标题|显示别名]]

  用途: 当笔记标题较长或不适合直接显示时，使用别名提供更自然的
        阅读体验。

  示例:

    源文件内容:                   链接解析:
    # 研究笔记                     目标: "React 状态管理最佳实践"
    参考 [[React 状态管理最         别名: "状态管理"
         佳实践|状态管理]]。

  解析规则:
    - | 前的部分是"真实标题"，用于匹配目标笔记
    - | 后的部分是"显示别名"，不影响链接匹配
    - 别名中不能包含 | 和 ]] 字符
    - 如目标标题中本身就包含 | 字符，无法直接用 wikilink 引用
      （需用 lo link 手动创建关系）`);

    // Sync behavior
    console.log(chalk.bold.yellow('\n  Wikilink 与 Sync 的协作'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  Wikilink 解析完全集成在 lo sync 中:

  ┌──────────────────────────┬─────────────────────────────────┐
  │  lo sync               │  标准增量同步                      │
  │                        │  - 新增 .md → 自动解析 wikilink     │
  │                        │  - 修改 .md → 自动更新 wikilink     │
  │                        │  - 未变更 .md → 不重新解析           │
  │                        │  - 不解析非 .md 文件                 │
  ├──────────────────────────┼─────────────────────────────────┤
  │  lo sync --wikilinks   │  增量同步 + 全量重建 wikilink       │
  │                        │  - 文件同步同标准增量                │
  │                        │  - 重新解析所有 .md 文件的 wikilink  │
  │                        │  - 用途: 标题修改后手动触发全量     │
  │                        │          重建、修复不一致            │
  ├──────────────────────────┼─────────────────────────────────┤
  │  lo sync --full         │  全量文件同步（不含全量 wikilink）   │
  │  --wikilinks            │  - 扫描所有文件检查变更             │
  │                        │  - 全量重建所有 .md 的 wikilink      │
  └──────────────────────────┴─────────────────────────────────┘

  典型场景:

  1. 新建笔记带 wikilink:
      写入 A.md 内容含 [[B]] → lo sync → wikilink 自动创建

  2. 修改 wikilink 目标:
      A.md 中把 [[B]] 改为 [[C]] → lo sync → 旧链接删除，新链接创建

  3. 修改被链接笔记的标题:
      B.md 标题从 "# 旧标题" 改为 "# 新标题"
      → A.md 中 [[旧标题]] 不再匹配 → 链接断开
      → 需要手动更新 A.md 中的引用 + lo sync
      → 或使用 lo sync --wikilinks 但不更新文件内容无法修复

  4. 批量修复标题变更:
      多篇笔记的标题修改后 → lo sync --wikilinks
      → 全量重新解析所有 .md，确保链接一致性

  5. 重命名文件:
      B.md → B-renamed.md → lo sync
      → 自动识别为重命名（hash 匹配）
      → wikilink 基于 RID，不受影响`);

    // Data model
    console.log(chalk.bold.yellow('\n  数据模型'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  Wikilink 关系存储在 relations 表中:

    CREATE TABLE relations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      from_rid    TEXT NOT NULL,          -- 源资源 RID（含 [[...]] 的文件）
      to_rid      TEXT NOT NULL,          -- 目标资源 RID（被链接的文件）
      type        TEXT NOT NULL,          -- 'wikilink' 或 'reference'
      name        TEXT,                   -- 链接显示名（别名 / 默认标题）
      created     TEXT NOT NULL,          -- 创建时间
      updated     TEXT NOT NULL,          -- 更新时间
      UNIQUE(from_rid, to_rid, type)
    );

  与 lo link 的共享存储:
    - lo link 创建的关系 type='reference'
    - [[wikilink]] 创建的关系 type='wikilink'
    - 两者共享同一张表，但 type 字段区分来源
    - 查询时可按 type 过滤: 只看 wikilink 或只看手动链接

  反向链接:
    - 当 A [[B]] 被解析时，自动创建:
      from_rid=A, to_rid=B, type='wikilink'   (A 链接到 B)
      from_rid=B, to_rid=A, type='wikilink'   (B 的反向链接)
    - 这是单向关系 + 自动反向，不是双向字段
    - 删除 A 中的 [[B]] 时，A→B 和 B→A 同时被删除`);

    // Titles, paths, and links
    console.log(chalk.bold.yellow('\n  标题 vs 路径 vs RID'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  理解 wikilink 引用链中三者的关系:

  ┌──────────┬──────────────────┬───────────────────────────┐
  │  概念    │  是什么           │  在 wikilink 中的角色      │
  ├──────────┼──────────────────┼───────────────────────────┤
  │  标题    │  # 后的文字       │  链接目标：[[标题]] 匹配   │
  │          │  可随时修改        │  标题变更 → 链接断裂      │
  │  路径    │  文件在磁盘的位置  │  不直接参与 wikilink       │
  │          │  可重命名/移动     │  但通过 sync 重命名检测   │
  │  RID     │  资源的永久 ID    │  关系存储的锚点           │
  │          │  永不改变          │  文件和标题可任意变        │
  └──────────┴──────────────────┴───────────────────────────┘

  举例:
    笔记A.md: # 笔记A          笔记B.md: # 笔记B
    内容: 参考 [[笔记B]]

    lo sync 后:
      A 的标题="笔记A", RID=res_aaa
      B 的标题="笔记B", RID=res_bbb
      relations: res_aaa → res_bbb (wikilink, name="笔记B")
                 res_bbb → res_aaa (wikilink, name="笔记A")

    重命名 B.md → B-renamed.md (lo sync 后):
      B 的路径变了，但 RID=res_bbb 不变
      relations 中的 res_bbb 仍然有效 → wikilink 不受影响

    修改 B 的标题从 "笔记B" → "新标题B":
      A.md 中的 [[笔记B]] 仍引用旧标题
      下次 sync: "笔记B" 匹配不到任何文件 → 链接断开
      需手动将 A.md 改为 [[新标题B]] 后 sync 恢复链接`);

    // Limitations and best practices
    console.log(chalk.bold.yellow('\n  使用建议与限制'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  适用场景:
    ✅ 笔记间的知识关联（Zettelkasten、MOC 等）
    ✅ 建立个人 wiki 网络
    ✅ 替代 [[...]] 语法的双向链接

  不适用场景:
    ❌ 链接到图片/PDF 等非 .md 文件（用 lo link）
    ❌ 链接到不存在或标题不匹配的文件（静默忽略）
    ❌ 在 lo 外部查看 wikilink 关系（存储在 SQLite 中）
    ❌ 跨仓库链接（lo 不支持仓库间链接）

  最佳实践:
    1. 保持标题稳定 — wikilink 依赖标题匹配，频繁改标题会断链
    2. 定期 lo sync --wikilinks — 标题变更后重建索引
    3. 用别名改善可读性 — [[长标题|简短名]] 保持笔记整洁
    4. 配合 lo link 使用 — wikilink 处理笔记内引用，lo link 处理跨类型关系
    5. 在笔记中保留清晰标题 — 没有 # 标题的 .md 文件无法被 [[...]] 引用`);

    // Commands reference
    console.log(chalk.bold.yellow('\n  相关命令'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
    lo sync                      增量同步（自动解析 wikilink）
    lo sync --wikilinks           增量同步 + 全量重建 wikilink
    lo sync --full --wikilinks    全量同步 + 全量重建 wikilink
    lo link <源> <目标>           手动建立资源链接
    lo unlink <源> <目标>         手动解除资源链接
    lo manual sync                查看 sync 命令完整手册`);
};
