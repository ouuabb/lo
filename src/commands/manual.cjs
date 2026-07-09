const chalk = require('chalk');

/**
 * lo manual — 命令参考手册
 *
 * 用法:
 *   lo manual              显示所有命令概览
 *   lo manual <命令名>      显示指定命令的详细用法
 */

const SECTIONS = {
  init: {
    title: 'init — 初始化资源仓库',
    usage: 'lo init [--path <路径>]',
    description: [
      '在指定目录创建资源仓库结构。',
      '',
      '执行 lo init 后会:',
      '  1. 创建 resources/ 资源目录',
      '  2. 创建 .repo/ 仓库元数据目录',
      '  3. 初始化 SQLite 数据库（database.sqlite）',
      '  4. 初始化暂存区（staging.json）',
      '  5. 生成 AES-256-GCM 加密密钥（.repo/keys/repo.key）',
      '  6. 创建 .note/config.json 用户配置文件',
      '',
      '选项:',
      '  --path    仓库根目录路径（默认: 当前工作目录）',
      '',
      '示例:',
      '  lo init                     # 在当前目录初始化',
      '  lo init --path ~/notes     # 在指定目录初始化',
      '',
      '注意事项:',
      '  - 如果仓库已存在，重复运行 lo init 不会覆盖已有数据',
      '  - 生成的加密密钥权限为 0o600（仅所有者可读写）',
      '  - 建议初始化后立即运行 lo auth add 绑定 SSH 密钥保护'
    ]
  },

  new: {
    title: 'new — 创建新资源',
    usage: 'lo new <标题> [--type <类型>] [--tags <标签>] [--category <分类>]',
    description: [
      '创建新的资源文件（不入库，入库在 lo add + lo commit 时完成）。',
      '',
      'rid 一等公民: 创建时不生成 rid，rid 在首次 commit 时分配。',
      '所有后续操作以 rid 为第一主键，支持 rid / name / path 三级查找。',
      '',
      '同名处理: 如果已有同名活跃资源（layer=0），新文件将自动入栈（layer>=1）。',
      '使用 lo stack 命令管理栈中副本。',
      '',
      '文件命名: YYYY-MM-DD-标题-随机8位.md（防止磁盘同名冲突）',
      '存储位置: resources/ 目录',
      '加密行为: 如果仓库已启用加密，文件自动以 LOEC 格式加密存储',
      '',
      '默认分类:',
      '  - 笔记类型（note）自动归入默认分类，默认为 "未分类"',
      '  - 非笔记类型（图片、PDF 等）自动归入 "其他资源"',
      '  - 可通过 lo config add category.defaultNote "名称" 自定义默认分类',
      '  - --category 显式指定时始终优先于默认值',
      '',
      '选项:',
      '  --type        资源类型（默认: note）',
      '                 可选: note, pdf, image, video, audio, html, text',
      '  --tags        标签，多个标签用逗号分隔',
      '  --category    分类名，支持多级路径如 编程/Python/爬虫',
      '',
      '示例:',
      '  lo new "理解闭包"                                # 创建笔记（自动"未分类"）',
      '  lo new "架构图" --type image                     # 创建图片（自动"其他资源"）',
      '  lo new "React笔记" --tags "前端,React"            # 带标签',
      '  lo new "爬虫技巧" --category 编程/Python/爬虫     # 多级分类',
      '  lo new "周一计划" --category "工作/周报"           # 指定分类',
      '',
      '注意: 创建后文件在磁盘但不入库，lo add + lo commit 时才分配 rid 并入栈',
      '',
      '相关命令: lo add, lo commit, lo stack, lo config, lo category'
    ]
  },

  import: {
    title: 'import — 导入资源',
    usage: 'lo import <路径> [--type <类型>] [--category <分类>]',
    description: [
      '将外部文件或整个目录导入到资源仓库。',
      '',
      '导入单个文件: 将文件复制到 resources/ 并注册到数据库',
      '导入目录: 递归扫描目录中的支持文件并批量导入',
      '同名冲突: 导入资源若与已有活跃资源同名，自动入栈（分配下一个空闲 layer），不覆盖已有数据',
      '加密行为: 导入的文件会自动以 LOEC 格式加密存储',
      '',
      '默认分类: 与 lo new 一样，笔记归入默认分类（"未分类"），其他类型归入"其他资源"',
      '可通过 --category 显式指定分类（支持多级路径），或通过 lo config 修改默认值。',
      '',
      '选项:',
      '  --type       统一指定资源类型（如不指定则根据扩展名推断）',
      '  --category   分类名，支持多级路径如 编程/Python/爬虫',
      '',
      '示例:',
      '  lo import ~/文档/笔记.md                            # 导入（自动默认分类）',
      '  lo import ~/文档/算法.md --category 编程/算法         # 导入并指定分类',
      '  lo import ~/Pictures --type image                   # 导入整个目录',
      '',
      '支持的扩展名: .md, .txt, .pdf, .png, .jpg, .mp4, .mp3, .html'
    ]
  },

  list: {
    title: 'list — 列出所有资源',
    usage: 'lo list [--type <类型>] [--tag <标签>] [--category <分类>] [--limit <数量>] [--format <格式>]',
    description: [
      '按条件筛选并列出资源，支持多种输出格式。',
      '',
      '输出信息: RID、资源类型、文件路径、标题、字数、标签、状态',
      '状态标识: [已提交] 表示文件已在最新提交中，[已修改] 表示有未提交变更',
      '',
      '选项:',
      '  --type        按资源类型过滤 (note, image, pdf 等)',
      '  --tag         按标签过滤',
      '  --category    按分类目录过滤',
      '  --limit       限制输出数量（默认: 20）',
      '  --format      输出格式: table（默认）、json、list',
      '',
      '示例:',
      '  lo list                          # 列出最近 20 个资源',
      '  lo list --type image             # 只列出图片',
      '  lo list --format json            # JSON 格式输出',
      '  lo list --limit 50               # 列出最近 50 个'
    ]
  },

  show: {
    title: 'show — 查看资源内容',
    usage: 'lo show <rid|name|文件路径> [--raw]',
    description: [
      '显示资源的详细信息和解密后的内容。',
      '',
      '三级查找: rid 精确匹配 > name 查找活跃层 > path 降级匹配。',
      '按 name 查找时只返回活跃层（layer=0），栈中资源需通过 rid 访问。',
      '',
      'RID: 资源唯一标识符（如 res_abc123_xxxxxxxx），可通过 lo list 获取',
      'name: 资源逻辑名称，全局唯一（活跃层）',
      '路径: 支持绝对路径或相对于仓库根目录的路径',
      '加密文件: 自动解密后显示明文内容',
      '',
      '选项:',
      '  --raw    显示原始文件内容（加密文件显示 LOEC 密文）',
      '',
      '示例:',
      '  lo show res_abc123                               # 按 RID 查看',
      '  lo show 笔记测试                                  # 按 name 查看',
      '  lo show "resources/2024-01-01-笔记.md"            # 按路径查看',
      '  lo show res_abc123 --raw                          # 查看原始内容',
      '',
      '相关命令: lo edit, lo docs rid'
    ]
  },

  edit: {
    title: 'edit — 编辑资源',
    usage: 'lo edit <rid|文件路径> [--editor <编辑器>]',
    description: [
      '使用编辑器打开资源文件进行编辑。',
      '',
      '加密文件处理流程:',
      '  1. 解密文件到临时目录',
      '  2. 打开编辑器编辑临时文件',
      '  3. 编辑完成后重新加密并写回原文件',
      '  4. 自动调用 refresh() 更新数据库中的散列值和元数据',
      '     （标题、字数等自动重新提取，标签/状态保留不变）',
      '',
      '选项:',
      '  --editor    指定编辑器命令（如 "code --wait"、"vim"）',
      '               不指定则使用系统默认编辑器',
      '',
      '示例:',
      '  lo edit res_abc123                           # 使用默认编辑器',
      '  lo edit res_abc123 --editor "code --wait"    # 使用 VS Code',
      '  lo edit "resources/笔记.md" --editor vim     # 使用 vim',
      '',
      '相关命令: lo show'
    ]
  },

  delete: {
    title: 'delete — 删除资源',
    usage: 'lo delete <rid|文件路径> [--force] [--hard]',
    description: [
      '删除资源，支持软删除（可恢复）和硬删除（永久）。',
      '',
      '软删除: 仅标记数据库记录为已删除，文件保留在磁盘上',
      '硬删除: 从数据库中永久移除记录，同时删除关联关系',
      '',
      '选项:',
      '  --force    跳过确认提示，直接删除',
      '  --hard     永久删除（不可恢复），不指定则软删除',
      '',
      '示例:',
      '  lo delete res_abc123             # 软删除（可恢复）',
      '  lo delete res_abc123 --hard      # 永久删除',
      '  lo delete res_abc123 --force     # 跳过确认'
    ]
  },

  add: {
    title: 'add — 添加文件到暂存区',
    usage: 'lo add <路径> [路径...]       lo add .',
    description: [
      '将文件添加到暂存区，是提交前的必要步骤。',
      '',
      '暂存行为:',
      '  - 指定文件路径：添加单个或多个文件',
      '  - 使用 . ：添加仓库目录下所有变更（新增、修改、删除），排除 .repo/node_modules/.git',
      '  - 新文件（数据库中不存在）→ 加入 added 列表',
      '  - 已存在文件（数据库中已有记录）→ 加入 modified 列表',
      '',
      '示例:',
      '  lo add "resources/笔记.md"              # 添加单个文件',
      '  lo add "resources/a.md" "resources/b.md" # 添加多个文件',
      '  lo add .                                 # 添加所有文件',
      '',
      '相关命令: lo commit, lo reset, lo status, lo diff'
    ]
  },

  commit: {
    title: 'commit — 提交暂存区',
    usage: 'lo commit [--message|-m <信息>] [--merge]',
    description: [
      '将暂存区的变更提交到仓库历史记录。',
      '',
      '提交流程:',
      '  1. 读取 staging.json 中的暂存内容',
      '  2. 新增文件 (added) → 导入到数据库',
      '  3. 修改文件 (modified) → 调用 refresh() 更新散列和元数据',
      '  4. 删除文件 (deleted) → 标记数据库记录为已删除',
      '  5. 重命名 (renamed) → 更新数据库路径',
      '  6. 元数据变更 (metadata) → 合并到数据库 metadata 列',
      '  7. 检测合并场景 → 如果存在 pull 产生的冲突入栈资源，自动标记为合并提交',
      '  8. 记录提交信息到 commits 表（含 merge 标记）',
      '  9. 清空暂存区',
      '',
      '合并提交:',
      '  pull 发现冲突后，远程版本自动入栈（layer>=1），本地版本保持不变。',
      '  用户手动比较、合并内容后，走正常的 add → commit 流程。',
      '  commit 会自动检测栈中的远程冲突资源（conflict_source: "remote"），',
      '  标记为合并提交（commits 表 merge=1）。',
      '  lo status 中合并提交会显示 [merge] 标签。',
      '  合并提交是一个全新的独立提交，既不是本地提交也不是远程提交。',
      '',
      '选项:',
      '  --message, -m    提交信息（必填）',
      '  --merge          手动标记为合并提交（通常自动检测，也可显式指定）',
      '',
      '示例:',
      '  lo commit -m "添加新笔记"',
      '  lo commit -m "合并远程修改"            # pull 冲突后的合并提交',
      '  lo commit --merge -m "手动合并"',
      '',
      '相关命令: lo add, lo reset, lo log, lo status, lo pull'
    ]
  },

  reset: {
    title: 'reset — 取消暂存',
    usage: 'lo reset [路径]',
    description: [
      '取消文件的暂存状态，或清空整个暂存区。',
      '',
      '用法:',
      '  lo reset <路径>     取消指定文件的暂存',
      '  lo reset HEAD       清空整个暂存区',
      '',
      '示例:',
      '  lo reset "resources/笔记.md"    # 取消单个文件暂存',
      '  lo reset HEAD                   # 清空所有暂存',
      '',
      '相关命令: lo add, lo commit'
    ]
  },

  log: {
    title: 'log — 查看提交历史',
    usage: 'lo log [--limit|-n <数量>]',
    description: [
      '查看仓库的提交历史记录。',
      '',
      '输出信息: 提交 ID、时间、提交信息、新增/修改/删除/重命名/元数据数量',
      '',
      '选项:',
      '  --limit, -n    显示数量限制（默认: 20）',
      '',
      '示例:',
      '  lo log             # 显示最近 20 条提交',
      '  lo log -n 10       # 显示最近 10 条提交'
    ]
  },

  status: {
    title: 'status — 查看工作区状态',
    usage: 'lo status [--path <路径>]',
    description: [
      '对比文件系统与数据库中的记录，显示工作区的变更状态。',
      '',
      '检测内容:',
      '  - 新增文件: 文件系统中存在但数据库中无记录',
      '  - 修改文件: 文件明文散列与数据库记录不一致（支持暂存/未暂存区分）',
      '  - 重命名: 自动匹配"删除"和"新增"的 hash，识别为同一文件',
      '  - 删除文件: 数据库中有记录但文件系统中不存在',
      '  - 暂存状态: 显示暂存区中的 added / modified / deleted / renamed / metadata',
      '',
      '加密文件: 检测基于明文 SHA-256 散列，即使多次加密同一内容也能正确识别',
      '',
      '选项:',
      '  --path    仓库路径（默认: 当前工作目录）',
      '',
      '示例:',
      '  lo status',
      '  lo status --path ~/notes',
      '',
      '相关命令: lo add, lo commit'
    ]
  },

  diff: {
    title: 'diff — 显示文件变更差异',
    usage: 'lo diff [路径]',
    description: [
      '显示暂存区和未暂存文件的变更差异。',
      '',
      '检测内容:',
      '  - 暂存区新增文件: 显示内容预览',
      '  - 暂存区修改文件: 显示旧/新散列、元数据变更（标题、字数）',
      '  - 暂存区删除文件: 显示标题和类型',
      '  - 未暂存修改文件: 显示散列变更',
      '  - 未跟踪文件: 列出文件系统中存在但数据库无记录的文件',
      '',
      '加密文件: 自动解密后对比明文散列',
      '',
      '示例:',
      '  lo diff                          # 显示所有变更差异',
      '  lo diff "resources/笔记.md"      # 查看特定文件的差异',
      '',
      '相关命令: lo add, lo commit, lo status'
    ]
  },

  link: {
    title: 'link — 建立资源链接',
    usage: 'lo link <源> <目标> [--type <类型>]',
    description: [
      '在两个资源之间建立双向引用关系。',
      '',
      '链接类型:',
      '  reference    引用关系（默认）',
      '',
      '示例:',
      '  lo link res_abc res_xyz                       # 建立引用',
      '  lo link res_abc res_xyz --type reference',
      '',
      '相关命令: lo unlink'
    ]
  },

  unlink: {
    title: 'unlink — 解除资源链接',
    usage: 'lo unlink <源> <目标> [--type <类型>]',
    description: [
      '解除两个资源之间的双向引用关系。',
      '',
      '链接类型:',
      '  reference    引用关系（默认）',
      '',
      '示例:',
      '  lo unlink res_abc res_xyz                     # 解除引用',
      '  lo unlink res_abc res_xyz --type reference',
      '',
      '相关命令: lo link'
    ]
  },

  rm: {
    title: 'rm — 暂存文件删除',
    usage: 'lo rm <路径>',
    description: [
      '将文件标记为待删除，添加到暂存区的 deleted 列表。',
      '',
      '与 delete 的区别:',
      '  - lo rm: 暂存删除操作，需配合 lo commit 才能生效',
      '  - lo delete: 直接对数据库执行删除（跳过暂存区）',
      '',
      '示例:',
      '  lo rm "resources/旧笔记.md"          # 暂存删除',
      '  lo rm resources/2024-01-01-笔记.md   # 暂存删除',
      '',
      '相关命令: lo add, lo commit, lo reset, lo delete'
    ]
  },

  move: {
    title: 'move — 移动资源',
    usage: 'lo move <rid|路径> <目标路径>',
    description: [
      '将资源文件移动到新的位置，同时更新数据库中的路径。',
      '',
      '示例:',
      '  lo move res_abc "resources/archived/旧笔记.md"',
      '  lo move "resources/笔记.md" "resources/done/笔记.md"'
    ]
  },

  tag: {
    title: 'tag — 管理标签',
    usage: 'lo tag <add|rm|list> <rid|路径> [标签]',
    description: [
      '对资源进行标签的添加、移除和查询操作。',
      '',
      '标签变更走暂存区工作流，添加/移除后需 lo commit 提交才生效。',
      '多次操作会累积在暂存区，lo tag list 会显示暂存中未提交的变更。',
      '',
      '操作:',
      '  add     暂存标签添加（需 commit）',
      '  rm      暂存标签移除（需 commit）',
      '  list    列出资源的所有标签（含暂存提示）',
      '',
      '示例:',
      '  lo tag add res_abc "前端"                       # 暂存标签添加',
      '  lo tag rm res_abc "前端"                        # 暂存标签移除',
      '  lo tag list res_abc                             # 列出所有标签',
      '  lo commit -m "更新标签"                          # 提交元数据变更',
    ]
  },

  category: {
    title: 'category — 管理分类',
    usage: 'lo category <set|rm|list|tree> [rid|路径] [分类名]',
    description: [
      '对资源进行分类的设置、移除、查询和树形展示。',
      '',
      '分类变更走暂存区工作流，设置/移除后需 lo commit 提交才生效。',
      '分类是单值字段，支持路径式多级分类（用 / 分隔），如 编程/Python/爬虫。',
      'lo category tree 以树形图展示所有分类的父子层级关系。',
      '',
      '操作:',
      '  set     暂存分类设置（需 commit），支持多级: 父/子/孙',
      '  rm      暂存分类移除（需 commit）',
      '  list    无参数: 列出所有分类（扁平）；带 rid: 查看单个资源分类',
      '  tree    树形展示所有分类的父子层级关系',
      '',
      '示例:',
      '  lo category set res_abc 编程                      # 设置一级分类',
      '  lo category set res_abc 编程/Python/爬虫          # 设置多级分类',
      '  lo category rm res_abc                           # 暂存分类移除',
      '  lo category list res_abc                         # 查看当前分类',
      '  lo category list                                 # 列出所有分类',
      '  lo category tree                                 # 树形展示父子关系',
      '  lo commit -m "更新分类"                           # 提交元数据变更',
    ]
  },

  sync: {
    title: 'sync — 同步资源',
    usage: 'lo sync [--full] [--quiet] [--wikilinks]',
    description: [
      '扫描文件系统，将变更同步到数据库。',
      '',
      'lo sync 和 lo add + lo commit 对 resources 表的结果完全等价：',
      '新文件都会获得 RID 并入库，修改的文件都会更新 hash，',
      '删除的文件都会标记。区别在于 sync 不写 commits 表，',
      '因此 lo log 看不到 sync 的变更记录。',
      '',
      '扫描范围: 整个仓库目录（排除 node_modules、.git、.repo）',
      '同步策略:',
      '  - 增量同步（默认）: 只扫描最后同步时间之后修改的文件',
      '  - 全量同步（--full）: 扫描所有文件，逐个检查变更',
      '  - 加密文件: 先解密再计算明文散列，与数据库记录比较',
      '',
      '检测内容:',
      '  - 新文件: 自动导入到数据库，.md 文件自动解析 [[wikilink]]',
      '  - 同名冲突: 自动入栈（分配下一个空闲 layer），不覆盖已有资源',
      '  - 修改文件: 更新数据库中对应的散列值，.md 文件自动更新 wikilink',
      '  - 重命名: 匹配删除和新增的 hash，自动识别并保留 RID（wikilink 不受影响）',
      '  - 删除文件: 标记数据库记录为已删除',
      '',
      '[[wikilink]] 自动解析:',
      '  - .md 文件的 [[链接目标]] 语法会被自动解析为双向链接',
      '  - 链接基于文件标题（# 标题）匹配，如: [[笔记B]] 匹配标题为"笔记B"的 .md 文件',
      '  - 支持别名语法: [[真实标题|显示别名]]，别名仅影响显示不影响链接',
      '  - 非 .md 文件不参与 wikilink 解析（可用 lo link 手动建立关系）',
      '  - wikilink 关系存储在 relations 表中（type=\'wikilink\'）',
      '  - 反向链接自动维护: A 链接 B 时，B 也自动获得指向 A 的反向链接',
      '  - 增量 sync 仅重新解析内容变更的 .md 文件',
      '',
      '选项:',
      '  --full      执行全量同步（扫描所有文件）',
      '  --quiet     静默模式，不输出详细报告',
      '  --wikilinks  全量重新扫描所有 .md 文件的 [[wikilink]]（不依赖增量）',
      '',
      'wikilink 与 lo link 的区别:',
      '  ┌──────────────────┬────────────────────┬─────────────────────┐',
      '  │  特性             │  [[wikilink]]       │  lo link             │',
      '  ├──────────────────┼────────────────────┼─────────────────────┤',
      '  │  创建方式         │  写在 .md 文件中     │  命令行手动执行       │',
      '  │  目标匹配         │  按标题匹配          │  按 RID 精确指定      │',
      '  │  存储位置         │  relations 表        │  relations 表        │',
      '  │  文件重命名后     │  自动保持（基于 RID） │  自动保持（基于 RID）│',
      '  │  标题变化后       │  下次 sync 自动更新  │  不受影响            │',
      '  │  适用场景         │  笔记内引用           │  跨类型资源关联      │',
      '  └──────────────────┴────────────────────┴─────────────────────┘',
      '',
      '示例:',
      '  lo sync                           # 增量同步',
      '  lo sync --full                    # 全量扫描',
      '  lo sync --wikilinks               # 增量同步 + 全量重建 wikilink',
      '  lo sync --full --quiet            # 后台静默全量同步',
      '  lo sync --full --wikilinks        # 全量同步 + 全量重建 wikilink'
    ]
  },

  push: {
    title: 'push — 推送变更到远程设备',
    usage: 'lo push <remote|别名> [--full]',
    description: [
      '将本地操作日志和资源文件打包，推送到远程设备。',
      '远程设备需要运行 lo pull 来接收。',
      '',
      '工作原理:',
      '  1. 扫描本地全部操作日志',
      '  2. 从远程拉取同步清单（sync_manifest.json）',
      '  3. 对比本地全部操作与远程清单，计算差集',
      '  4. 若远程有本地未知的操作 → 拦截推送，强制先 lo pull',
      '  5. 将缺少的操作和关联资源打包为同步批次',
      '  6. 通过 SCP/本地拷贝推送到远程',
      '  7. 更新远程同步清单（原清单 + 本次新增）',
      '',
      '推送策略: 基于远程清单做差集计算，与推送设备无关。',
      '无论从哪台设备推送，都只传远程缺少的操作。',
      '首次推送时远程无清单，自动全量推送。',
      '',
      '拦截规则: 如果远程有其他设备推送的新操作（本地没有），',
      'push 会直接拒绝，避免产生分叉。必须先 pull 拉取并处理冲突，',
      '再走合并提交流程，最后推送。',
      '完整流程: pull → 冲突入栈 → 手动合并 → add → commit → push',
      '',
      '远程地址格式:',
      '  user@host:/path/to/repo             # SSH 远程',
      '  /absolute/local/path                # 绝对本地路径',
      '  C:\\absolute\\path                    # Windows 绝对路径',
      '  别名                                # 预先通过 lo remote add 配置的名称',
      '',
      '选项:',
      '  --full    忽略远程清单，将本地全部操作重新推送。',
      '            仅用于远程清单损坏或批次丢失的修复场景，平时不需要',
      '',
      '示例:',
      '  lo push me@desktop:~/notes          # 推送到远程桌面',
      '  lo push myserver                    # 使用别名推送',
      '  lo push /mnt/shared/notes           # 推送到本地共享目录',
      '  lo push --full me@server:/notes     # 修复: 强制全量重推'
    ]
  },

  pull: {
    title: 'pull — 从远程设备拉取变更',
    usage: 'lo pull <remote|别名>',
    description: [
      '从远程设备拉取所有同步批次，应用缺少的操作到本地。',
      '',
      '工作原理:',
      '  1. 从远程拉取同步清单（sync_manifest.json）',
      '  2. 对比远程清单与本地已有操作，计算缺少的 op_id',
      '  3. 拉取远程所有同步批次文件',
      '  4. 解包各批次，过滤出本地缺少的操作',
      '  5. 安装资源文件到本地 resources/ 目录',
      '  6. 逐条应用新操作日志（含冲突检测）',
      '',
      '冲突处理:',
      '  - 同一资源两边都编辑了（RESOURCE_UPDATED 冲突）',
      '    → 本地版本保持不变（layer=0），远程版本自动入栈（layer>=1）',
      '      用户通过 lo stack list 查看，手动合并后走 add → commit 流程',
      '  - 远程删除但本地有编辑 → 保留本地版本',
      '  - 远程新建资源与本地同名 → 自动入栈（layer>=1），不覆盖本地活跃资源',
      '  - 栈满（20层）→ 回退到 .conflict 文件方式',
      '  - 正常操作 → 直接应用',
      '',
      '合并流程: pull 产生冲突后，完整工作流为:',
      '  lo pull           → 冲突版本入栈',
      '  lo stack list     → 查看冲突',
      '  (手动比较、合并内容)',
      '  lo add <资源>     → 暂存合并结果',
      '  lo commit -m "合并远程修改"  → 自动生成合并提交 [merge]',
      '  lo push           → 推送合并提交',
      '',
      '远程地址格式:（同 push）',
      '',
      '示例:',
      '  lo pull me@laptop:~/notes           # 从笔记本拉取变更',
      '  lo pull myserver                    # 使用别名拉取',
      '  lo pull /mnt/shared/notes           # 从共享目录拉取'
    ]
  },

  clone: {
    title: 'clone — 从远程仓库克隆',
    usage: 'lo clone <remote|别名> [--dest <path>]',
    description: [
      '从远程仓库克隆完整副本到新设备。',
      '',
      '工作原理:',
      '  1. 初始化目标目录',
      '  2. 拉取远程所有同步批次',
      '  3. 初始化本地仓库（需要手动设置加密密钥）',
      '  4. 安装所有资源文件',
      '  5. 应用全部操作日志重建索引',
      '',
      '前置条件:',
      '  - 远程仓库已在另一台设备上通过 lo push 推送过',
      '  - 如果仓库启用了加密，需要先在本地 lo auth add 绑定 SSH 密钥',
      '',
      '选项:',
      '  --dest, -d                           # 克隆目标目录（默认当前目录）',
      '',
      '示例:',
      '  lo clone me@server:/notes --dest ./my-notes',
      '  lo clone myserver -d ~/notes           # 使用别名克隆',
      '  lo clone /shared/notes -d ~/notes'
    ]
  },

  remote: {
    title: 'remote — 管理远程仓库别名',
    usage: 'lo remote <add|remove|list> [别名] [地址]',
    description: [
      '管理远程仓库的别名，简化 push/pull/clone 命令的地址输入。',
      '',
      '操作:',
      '  add <name> <url>    添加远程别名',
      '  remove <name>       移除远程别名（也可用 rm）',
      '  list                列出所有已配置的远程别名（也可用 ls）',
      '',
      '别名存储: 保存在仓库数据库的 sync_config 表中，',
      '           每个仓库独立管理自己的远程别名。',
      '',
      '支持的命令: 配置别名后，push/pull/clone 都可以使用别名替代完整地址。',
      '',
      '示例:',
      '  lo remote add myserver root@192.168.1.100:/data/notes',
      '  lo remote add backup /mnt/backup/notes',
      '  lo remote list',
      '  lo remote remove backup',
      '',
      '使用别名:',
      '  lo push myserver          # 等价于 lo push root@192.168.1.100:/data/notes',
      '  lo pull myserver',
      '  lo clone myserver --dest ./my-notes'
    ]
  },

  serve: {
    title: 'serve — 启动本地 HTTP API 服务',
    usage: 'lo serve [--port <端口>] [--repo <路径>]',
    description: [
      '在当前仓库启动一个本地 HTTP 服务，提供 REST API 接口。',
      '',
      '安全设计:',
      '  - 默认只监听 127.0.0.1（本机回环地址），不对外暴露',
      '  - 使用 SSH 挑战-应答认证（复用 lo auth 注册的密钥）',
      '  - 加密仓库需先通过 SSH 认证',
      '  - 仓库在服务运行期间保持打开状态',
      '',
      '选项:',
      '  --port, -p              # 监听端口（默认: 8765）',
      '  --repo, -r              # 仓库路径（默认: 当前目录）',
      '',
      '认证流程（SSH 挑战-应答）:',
      '  1. POST /api/auth/challenge       获取挑战 nonce',
      '  2. ssh-keygen -Y sign             用本地 SSH 私钥签名',
      '  3. POST /api/auth/login           提交签名，获取 session token',
      '  4. 后续请求带 Authorization: Bearer <session-token>',
      '',
      'API 端点:',
      '  POST   /api/auth/challenge  请求认证挑战',
      '  POST   /api/auth/login      提交 SSH 签名获取 token',
      '  GET    /api/health          健康检查 + 仓库统计',
      '  GET    /api/notes           获取资源列表（?type=&limit=&offset=）',
      '  GET    /api/notes/:rid      获取资源详情（含内容）',
      '  POST   /api/notes           创建文本资源（{ type, content, title, tags, metadata }）',
      '  POST   /api/notes/upload    上传文件（multipart: file, title, tags）',
      '  PUT    /api/notes/:rid      更新资源（{ content, title, tags, metadata }）',
      '  DELETE /api/notes/:rid      删除资源（?hard=true 永久删除）',
      '  GET    /api/search           搜索资源（?q=关键词）',
      '  GET    /api/stats            仓库统计',
      '  GET    /api/tags             所有标签列表',
      '  POST   /api/sync             触发本地同步（?full=true 全量）',
      '  POST   /api/sync/push        推送到远程（{ remote }）',
      '  POST   /api/sync/pull        从远程拉取（{ remote }）',
      '',
      '示例:',
      '  lo serve                                 # 默认端口 8765',
      '  lo serve --port 9000                      # 自定义端口',
      '  lo serve -p 8888 -r ~/notes               # 完整参数',
      '',
      'curl 测试（SSH 认证）:',
      '  # 获取挑战',
      '  curl -X POST http://127.0.0.1:8765/api/auth/challenge',
      '',
      '  # 签名（需 OpenSSH >= 8.1）',
      '  echo -n "<nonce>" > /tmp/challenge.txt',
      '  ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n lo-cli /tmp/challenge.txt',
      '',
      '  # 登录获取 token',
      '  curl -X POST -H "Content-Type: application/json" \\',
      '       -d \'{"nonce":"<nonce>","fingerprint":"SHA256:xxx","signature":"<base64>"}\' \\',
      '       http://127.0.0.1:8765/api/auth/login',
      '',
      '  # 使用 token 调用业务接口',
      '  curl -H "Authorization: Bearer <token>" \\',
      '       http://127.0.0.1:8765/api/health',
      '',
      '  # 创建笔记',
      '  curl -X POST -H "Content-Type: application/json" \\',
      '       -H "Authorization: Bearer <token>" \\',
      '       -d \'{"title":"新笔记","content":"内容..."}\' \\',
      '       http://127.0.0.1:8765/api/notes',
      '',
      '  # 上传文件',
      '  curl -X POST \\',
      '       -H "Authorization: Bearer <token>" \\',
      '       -F "file=@photo.jpg" \\',
      '       -F "title=我的照片" \\',
      '       -F "tags=photo,trip" \\',
      '       http://127.0.0.1:8765/api/notes/upload',
      '',
      '注意事项:',
      '  - 端口仅建议用 127.0.0.1，不要改为 0.0.0.0 暴露公网',
      '  - 仓库注册 SSH 公钥后自动启用认证（lo auth add）',
      '  - 未注册公钥时不强制认证（任何本机程序均可调用）',
      '  - session token 有效期 60 分钟，过期后需重新登录',
      '  - SQLite 不支持高并发写入，本服务通过写锁排队保证数据安全',
      '  - 加密仓库在服务启动时完成一次性认证，运行期间不重复认证'
    ]
  },

  find: {
    title: 'find — 搜索资源',
    usage: 'lo find <关键词> [--limit <数量>] [--type <类型>]',
    description: [
      '全文搜索资源标题和内容。',
      '',
      '搜索范围: 资源标题（数据库中）和内容关键词',
      '加密文件: 搜索时自动解密后匹配关键词',
      '',
      '选项:',
      '  --limit    结果数量限制（默认: 10）',
      '  --type     按资源类型过滤',
      '',
      '示例:',
      '  lo find "闭包"                            # 搜索关键词',
      '  lo find "React" --type note               # 搜索笔记',
      '  lo find "分布式" --limit 20               # 限制结果数'
    ]
  },

  stack: {
    title: 'stack — 管理资源栈',
    usage: 'lo stack <list|pop|drop> [name] [layer]',
    description: [
      '管理同名资源冲突时自动保存的冗余副本（栈层）。',
      '',
      '核心概念:',
      '  每个资源名称最多可有 20 层（layer 0~19）。',
      '  layer 0 为活跃层（日常操作默认使用的版本），',
      '  layer 1~19 为栈层（自动冗余备份）。',
      '',
      '自动入栈: 任意入口（lo new、拖文件、lo sync）遇到同名资源时，',
      '  新文件会自动分配到下一个空闲栈层，无需手动干预。',
      '',
      '栈隔离: 日常操作（show/edit/delete/tag/link）默认只操作活跃层，',
      '  栈中资源不影响正常使用。通过 rid 可直接操作任意层。',
      '',
      '子命令:',
      '  list                列出所有栈中资源，按 name 分组显示',
      '  pop  <name>         弹出栈顶，提升为活跃层（原活跃层入栈）',
      '  drop <name> <layer> 丢弃指定栈层（硬删除）',
      '',
      '示例:',
      '  lo stack list                        # 查看所有栈中资源',
      '  lo stack pop 笔记测试                  # 将栈顶提升为活跃',
      '  lo stack drop 笔记测试 1               # 丢弃 layer 1',
      '',
      '相关命令: lo new, lo sync, lo docs stack'
    ]
  },

  stats: {
    title: 'stats — 显示统计信息',
    usage: 'lo stats',
    description: [
      '显示资源仓库的统计数据。',
      '',
      '统计内容: 资源总数、各类型数量、标签分布等',
      '',
      '示例:',
      '  lo stats'
    ]
  },

  index: {
    title: 'index — 生成索引',
    usage: 'lo index',
    description: [
      '生成或更新仓库根目录下的 README.md 索引文件。',
      '',
      '索引内容: 按类型和时间组织的资源列表，',
      '           包含标题、路径和简要描述。',
      '',
      '示例:',
      '  lo index'
    ]
  },

  daily: {
    title: 'daily — 创建今日日记',
    usage: 'lo daily',
    description: [
      '创建包含今日模板的日记文件。',
      '',
      '模板内容:',
      '  - 今日完成',
      '  - 待办事项',
      '  - 想法记录',
      '',
      '文件命名: YYYY-MM-DD-daily.md',
      '',
      '示例:',
      '  lo daily'
    ]
  },

  backup: {
    title: 'backup — 备份资源仓库',
    usage: 'lo backup [--dest <目录>] [--compress]',
    description: [
      '备份仓库文件到指定目录。',
      '',
      '备份内容: resources/ 目录、.repo/ 目录（但不含 .repo/keys/）',
      '安全设计: 自动排除 .repo/keys/ 目录，避免加密密钥泄漏到备份中',
      '',
      '选项:',
      '  --dest       备份目标目录（默认: ./backups）',
      '  --compress   压缩备份为 .zip 文件',
      '',
      '示例:',
      '  lo backup                                        # 默认位置备份',
      '  lo backup --dest /mnt/backup                     # 指定位置',
      '  lo backup --dest ./archives --compress           # 压缩备份',
      '',
      '恢复提示: 备份不含加密密钥（.repo/keys/），恢复后需要通过 SSH',
      '           认证或 lo auth add 重新关联密钥。'
    ]
  },

  config: {
    title: 'config — 管理配置',
    usage: 'lo config <list|add|rm> [key] [dir]',
    description: [
      '管理仓库的配置项。',
      '',
      '操作:',
      '  list    列出所有配置项',
      '  add     添加监控目录',
      '  rm      移除配置项',
      '',
      '示例:',
      '  lo config list                         # 查看配置',
      '  lo config add work ~/Documents/notes   # 添加监控目录',
      '  lo config rm work                      # 移除配置项'
    ]
  },

  auth: {
    title: 'auth — 管理 SSH 身份认证',
    usage: 'lo auth <操作> [选项...]',
    description: [
      '管理仓库的 SSH 密钥认证和加密密钥保护。',
      '',
      '操作:',
      '  add         绑定 SSH 密钥，用 SSH 私钥保护加密密钥',
      '  enable      启用 SSH 认证',
      '  disable     禁用 SSH 认证（恢复明文密钥存储）',
      '  remove      移除已绑定的设备密钥',
      '  list        列出已注册的 SSH 密钥',
      '  status      查看当前认证状态',
      '  verify      手动验证 SSH 签名',
      '  keys        扫描本地可用的 SSH 密钥',
      '',
      'add 选项:',
      '  --key-path, -k     SSH 公钥文件路径',
      '  --label, -l        设备标签（如"笔记本"、"台式机"）',
      '',
      'remove 选项:',
      '  --fingerprint, -f  要移除的密钥指纹',
      '',
      '通用选项:',
      '  --ttl              认证会话有效期（分钟，默认: 15）',
      '',
      '示例:',
      '  lo auth add -k ~/.ssh/id_ed25519 -l "笔记本"   # 添加密钥',
      '  lo auth add -k ~/.ssh/id_rsa -l "台式机"       # 添加第二台设备',
      '  lo auth list                                    # 列出已注册密钥',
      '  lo auth remove -f SHA256:abc123...              # 移除设备',
      '  lo auth disable                                 # 禁用认证',
      '',
      '安全说明: 详见 lo docs - SSH 认证章节',
      '相关文档: lo docs'
    ]
  },

  help: {
    title: 'help — 查看帮助',
    usage: 'lo help',
    description: [
      '显示简洁的命令列表和分类概览。',
      '',
      '示例:',
      '  lo help'
    ]
  },

  manual: {
    title: 'manual — 查看命令手册',
    usage: 'lo manual [命令名]',
    description: [
      '查看命令的详细参考手册。',
      '',
      '不带参数时显示所有可用命令的概览和快速索引。',
      '指定命令名时显示该命令的详细用法和示例。',
      '',
      '示例:',
      '  lo manual               # 查看所有命令概览',
      '  lo manual init          # 查看 init 命令详情',
      '  lo manual auth          # 查看 auth 命令详情',
      '',
      '相关命令: lo help, lo docs'
    ]
  },

  docs: {
    title: 'docs — 查看项目功能详解',
    usage: 'lo docs',
    description: [
      '查看项目核心功能的详细说明文档，包括端到端加密、',
      'SSH 认证、密钥架构等概念性内容。',
      '',
      '示例:',
      '  lo docs'
    ]
  },

  resource: {
    title: 'create resource — 创建容器资源',
    usage: 'lo create resource <type> <path> [--name <名称>] [--no-scan]',
    description: [
      '创建具有 Container Capability 的 Resource 实体。',
      '',
      'Resource 是独立的一等公民实体，拥有唯一 RID、类型 (type)、',
      '能力列表 (capabilities) 和容器规则 (container_schema)。',
      '每个 Resource 可以绑定一个或多个 Content Source（内容来源），',
      'Content Source 可以是本地目录、Git 仓库等多种形式。',
      '',
      'Container Capability:',
      '  具有 container 能力的 Resource 可以管理成员。',
      '  创建时会自动扫描 Content Source 目录中的文件，',
      '  将其作为 File Member 添加到容器的 container_members 中。',
      '',
      '支持的资源类型:',
      '  project     项目（代码、文档混合）  allowed: note,document,image,code,json,yaml,xml,csv,text',
      '  album       相册                    allowed: image,video',
      '  dataset     数据集                  allowed: csv,json,yaml,xml',
      '  course      课程                    allowed: note,video,audio,document,image,pdf',
      '  collection  集合                    allowed: (无限制)',
      '',
      '自动行为:',
      '  - 根据 type 自动推导 capabilities 和 container_schema',
      '  - 自动绑定指定的 Content Source 目录',
      '  - 如果具有 container 能力，自动扫描目录中的文件为成员',
      '',
      '选项:',
      '  --name        资源名称（默认使用目录名）',
      '  --no-scan     跳过自动扫描成员（仅绑定 Content Source）',
      '',
      '示例:',
      '  lo create resource project ./fastapi-demo              # 创建项目',
      '  lo create resource album ./photos --name "旅行照片"     # 创建相册',
      '  lo create resource dataset ./data --no-scan            # 创建数据集（不扫描）',
      '  lo create resource course ./python-101                 # 创建课程',
      '',
      '相关命令: lo promote, lo docs resource-container'
    ]
  },

  promote: {
    title: 'promote — 提升容器成员为独立 Resource',
    usage: 'lo promote <路径> [--container <rid>] [--type <类型>]',
    description: [
      '将容器中的普通 File Member 提升为独立的 Resource 实体。',
      '',
      '提升前: File Member 只是一个文件条目，没有独立 RID，不能参与 Relation',
      '提升后: 拥有独立 RID、可以建立 Relation、可以添加标签和分类',
      '',
      '核心价值:',
      '  - 容器中的代码文件默认为 File Member',
      '  - 当某个文件需要被标记、引用或关联时，通过 promote 提升',
      '  - 提升后的 Resource 仍然是容器的成员（保持 container_rid 关联）',
      '  - 同一个文件不会重复提升（幂等操作）',
      '',
      '自动查找到容器:',
      '  如果不指定 --container，promote 会自动遍历所有具有 container',
      '  capability 的 Resource，找到包含该文件路径的容器。',
      '',
      '类型派生:',
      '  如果不指定 --type，根据文件扩展名自动推导:',
      '  .md → note, .py/.js/.ts → code, .png/.jpg → image 等',
      '',
      '选项:',
      '  --container, -c     容器 RID（不指定则自动查找）',
      '  --type, -t          目标 Resource 类型（默认根据扩展名推导）',
      '',
      '示例:',
      '  lo promote docs/architecture.md               # 自动查找容器并提升',
      '  lo promote src/main.py --type code            # 指定类型',
      '  lo promote docs/design.md -c res_abc123       # 指定容器',
      '',
      '提升后的操作:',
      '  lo link <rid1> <rid2>          # 与其他 Resource 建立关系',
      '  lo tag add <rid> "重要"         # 添加标签',
      '  lo category set <rid> 设计      # 设置分类',
      '',
      '相关命令: lo create resource, lo docs resource-container'
    ]
  }
};

function printDivider() {
  console.log(chalk.gray('─'.repeat(80)));
}

function printSection(section) {
  console.log('\n' + chalk.bold.green(section.title));
  printDivider();
  console.log(chalk.yellow('  用法: ') + section.usage);
  console.log('');
  for (const line of section.description) {
    if (line.startsWith('  ')) {
      console.log(chalk.gray(line));
    } else if (line.startsWith('示例')) {
      console.log(chalk.bold(line));
    } else if (line === '') {
      console.log('');
    } else {
      console.log('  ' + line);
    }
  }
  console.log('');
}

function printOverview() {
  console.log(chalk.bold.cyan('\n  lo 命令参考手册'));
  console.log(chalk.gray('\n  用法: lo manual <命令名>    查看指定命令的详细说明'));
  console.log(chalk.gray('  用法: lo manual              显示本概览（所有命令）'));
  console.log(chalk.gray('  相关: lo help (简洁帮助)  |  lo docs (功能详解)'));

  const categories = [
    { name: '基础命令', cmds: ['init', 'new', 'import', 'list', 'show', 'edit', 'delete'] },
    { name: '版本控制', cmds: ['add', 'commit', 'reset', 'diff', 'log', 'status', 'rm'] },
    { name: '资源管理', cmds: ['resource', 'promote', 'link', 'unlink', 'move', 'tag', 'category', 'sync', 'stack'] },
    { name: '远程同步', cmds: ['remote', 'push', 'pull', 'clone', 'serve'] },
    { name: '搜索与查询', cmds: ['find', 'stats', 'index'] },
    { name: '安全', cmds: ['auth'] },
    { name: '其他', cmds: ['daily', 'backup', 'config', 'help', 'manual', 'docs'] }
  ];

  for (const cat of categories) {
    console.log('\n' + chalk.bold.cyan(cat.name));
    printDivider();
    for (const cmd of cat.cmds) {
      const section = SECTIONS[cmd];
      const firstLine = section.description[0];
      const shortDesc = firstLine.length > 42 ? firstLine.substring(0, 42) + '...' : firstLine;
      console.log('  ' + chalk.yellow(cmd.padEnd(10)) + '  ' + chalk.gray(shortDesc));
    }
  }

  console.log(chalk.gray('\n  使用 lo manual <命令名> 查看命令的详细用法和示例'));
}

module.exports = function manual(argv) {
  const cmd = (argv && argv.command) || (argv && argv._ && argv._[1]);

  if (!cmd || !SECTIONS[cmd]) {
    if (cmd) {
      console.log(chalk.red(`\n  未找到命令: ${cmd}`));
      console.log(chalk.gray('  运行 lo manual 查看所有支持的命令'));
      process.exit(0);
    }
    printOverview();
    process.exit(0);
  }

  printSection(SECTIONS[cmd]);
  process.exit(0);
};
