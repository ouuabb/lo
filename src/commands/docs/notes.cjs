const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  lo - 笔记详解'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.bold.yellow('\n  一、什么是笔记'));
    console.log(`
  在 lo 中，"笔记"是一种资源类型（type: 'note'），以 Markdown 格式
  存储在 resources/ 目录中。它是 lo 最核心的使用场景。

  笔记的本质：
    - 一个以 .md 结尾的 Markdown 文本文件
    - 文件名遵循 YYYY-MM-DD-标题转slug 的命名规范
    - 第一行的 # heading 被自动提取为笔记标题
    - 每条笔记拥有唯一的 RID（资源标识符）

  和普通 Markdown 文件的区别：
    普通 .md 文件         lo 管理的笔记
    ──────────────────    ──────────────────────────
    只存在于文件系统       文件系统 + SQLite 数据库索引
    无法快速搜索           支持全文搜索（fuse.js）
    无元数据追踪           自动提取标题、字数、链接、待办
    无版本历史             支持暂存区 + 提交历史（类似 Git）
    无标签/分类            支持标签和分类体系
    无双向链接             支持 [[wikilink]] 自动双向链接
    无加密保护             可选端到端加密（AES-256-GCM）`);

    console.log(chalk.bold.yellow('\n  二、笔记的文件格式'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  文件命名规则：

    格式: YYYY-MM-DD-{slug}.md
    示例: 2026-07-05-li-jie-bi-bao.md   (理解闭包)
         2026-07-05-react-zhuang-tai-guan-li.md  (React 状态管理)

    Slug 是从标题通过以下规则生成的：
      - 中文转为拼音（保留语义）
      - 所有字母转为小写
      - 空格和特殊字符替换为连字符 -
      - 多个连字符合并为一个

  笔记内容结构：

    # 标题 （第一行 # heading，被自动提取为 title）
              ← 标题和正文之间应有一个空行
    正文内容开始...
    可以使用 Markdown 语法：
    - 列表
    - **粗体** 和 *斜体*
    - [链接](url)
    - ![图片](url)
    - \`代码块\`
    - [[其他笔记标题]]   （wikilink 双向链接）
    - - [ ] 待办事项     （会被自动提取为 todos）
    - > 引用`);

    console.log(chalk.bold.yellow('\n  三、笔记的元数据'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  lo 在索引笔记时自动提取以下元数据，存储分为两层：

  SQLite resources 表的结构字段（所有资源类型共用）：

  ┌─────────────┬──────────────────────────────────────────┐
  │  列名        │  说明                                    │
  ├─────────────┼──────────────────────────────────────────┤
  │  rid         │  资源唯一标识符 (res_xxxxxxxxxxxx)        │
  │  type        │  资源类型（note/image/pdf/video/...）     │
  │  path        │  resources/ 下的相对路径                  │
  │  hash        │  明文 SHA-256（内容变更检测）             │
  │  metadata    │  JSON 元数据（见下方字段表）              │
  │  encrypted   │  是否已加密 (0/1)                        │
  │  created     │  创建时间戳 (ms)                         │
  │  updated     │  最后修改时间戳 (ms)                     │
  │  deleted     │  是否已软删除 (0/1)                      │
  └─────────────┴──────────────────────────────────────────┘

  metadata JSON 字段（写入时严格校验，字段不存在或类型错误直接报错）：

  ┌───────────────┬──────────────┬─────────────────────────────────┐
  │  字段          │  类型         │  说明                           │
  ├───────────────┼──────────────┼─────────────────────────────────┤
  │  title         │  string      │  从 # heading 提取，非空字符串   │
  │  wordCount     │  number      │  词数统计，整数 >= 0             │
  │  tags          │  string[]    │  标签列表，元素为非空字符串       │
  │  category      │  string|null │  分类（路径式多级，如"编程/Python"，空字符串→null）│
  │  status        │  string      │  draft / published / archived    │
  │  conflict      │  boolean     │  同步冲突标记（系统自动设置）     │
  │  original_rid  │  string      │  冲突来源 RID（以 res_ 开头）    │
  │  mimetype      │  string      │  MIME 类型（含 /），如 image/png │
  │  size          │  number      │  文件大小（字节）>= 0            │
  └───────────────┴──────────────┴─────────────────────────────────┘

  校验规则（严格模式）：
    - 写入上述字段时类型必须匹配，否则抛出错误
    - 写入上述以外的字段（如拼写错误的 tgas、titel）直接报错
    - tags 元素不能为空字符串，重复值自动去重
    - category 设为 '' 或 undefined 时自动规范化为 null
    - title 仅 note 类型自动提取，其他类型不提取
    - wordCount 仅 note 类型自动提取，其他类型不提取
    - conflict / original_rid 由同步冲突解决自动写入，不应手动设置
    - mimetype / size 由 HTTP API 上传端点自动写入，对本地笔记无意义`);

    console.log(chalk.bold.cyan('\n  标题提取 —— 从 # heading 提取 title'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`

  标题是笔记最重要的元数据之一，它不仅是列表显示、搜索匹配的核心字段，
  也是 [[wikilink]] 双向链接中通过标题方式匹配的关键依据（推荐使用
  [[res_xxx]] RID 方式以获得精确性，详见"十一、笔记间的链接"）。

  提取规则：

    正则表达式: /^#\s+(.+)$/m

    ^          行的开头（m 标志使 ^ 匹配每行的开头，而非仅字符串开头）
    #          字面量 # 字符
    \s+        一个或多个空白字符（空格、制表符）
    (.+)       捕获组：匹配任意字符（至少一个），括号内的内容被提取为标题
    $          行的结尾
    /m         multiline 模式，使 ^ 和 $ 匹配每一行的行首和行尾

  示例一：标准笔记
    ─────────────────────────────────
    文件内容:
      # 理解 JavaScript 闭包          ← 这一行被匹配

      闭包是 JavaScript 中...

    提取结果: title = "理解 JavaScript 闭包"

  示例二：多级标题
    ─────────────────────────────────
    文件内容:
      # 主标题                        ← 匹配第一个 # heading

      ## 第一节                       ← 这是 ## 不会被匹配

      ### 子节                        ← 这是 ### 不会被匹配

    提取结果: title = "主标题"
    说明: 只有第一个 ^# （一级标题）会被提取，## 或 ### 等深层级标题被忽略。

  示例三：标题不在第一行
    ─────────────────────────────────
    文件内容:
      ---
      author: 张三
      date: 2026-07-05
      ---

      # 实际标题                      ← 虽然不在第一行，但仍然是第一个 # heading

    提取结果: title = "实际标题"
    说明: 正则 /m 模式按行匹配，不要求 # heading 必须在文件第一行，
    只要某行以 # + 空格 开头即可。前导的 YAML front matter 或空行不影响匹配。

  示例四：无 # heading 的情况
    ─────────────────────────────────
    文件内容:
      这是一段没有标题的文字。
      没有 # 开头的行。

    提取结果: title = 从文件名推算
    说明: 如果文件内容中完全找不到 ^# ，则进入 fallback 逻辑——

  Fallback —— 无 heading 时从文件名推算
  ─────────────────────────────────────────────

  当笔记内容中没有 # heading 时，title 由文件名推算：

    源文件: src/core/note.cjs  →  Note.guessTitle()
    源文件: src/repo/resourceService.cjs  →  ResourceService._extractMetadata()

  推算逻辑:
    1. 取文件名的 basename（不含目录路径和扩展名）
    2. 去掉开头的日期前缀（正则: /^\d{4}-\d{2}-\d{2}-/）
    3. 剩余部分作为标题

  举例:
    文件名                                │  提取的 title
    ─────────────────────────────────────┼────────────────
    2026-07-05-li-jie-bi-bao.md          │  li-jie-bi-bao
    2026-07-05-.md                       │  (空字符串)
    readme.md                            │  readme
    my-notes.md                          │  my-notes

  注意: ResourceService._extractMetadata() 仅在 type === 'note' 时提取标题，
  其他资源类型（image、pdf 等）不会执行 heading 匹配。

  标题更新的时机：
    - 创建笔记 (lo new) 时：内容自带 # heading，立即提取
    - 导入文件 (lo import) 时：读取文件 → 匹配 # heading → 提取
    - 同步 (lo sync) 时：增量同步中，被修改的 .md 文件会重新提取元数据
    - 刷新 (refresh) 时：主动调用时重新解析文件内容更新 title
    - Note.update() 方法：写入新内容后重新匹配 # heading 更新 this.title

  标题在整个系统中的作用：

  ┌──────────────────┬──────────────────────────────────────┐
  │  用途             │  说明                                │
  ├──────────────────┼──────────────────────────────────────┤
  │  列表显示          │  lo list 中作为笔记的主要标识       │
  │  搜索匹配          │  lo find "闭包" 会在标题中搜索      │
  │  wikilink 链接     │  [[res_xxx]] 按 RID 精确匹配；         │
  │                   │  [[笔记标题]] 按标题匹配（标题可重复时   │
  │                   │  优先使用 RID 方式）                    │
  │  统计展示          │  lo stats 中显示最近笔记的标题      │
  │  HTTP API          │  GET /api/notes 返回的 title 字段   │
  │  文件名生成        │  lo new 时标题 → slug → 文件名      │
  └──────────────────┴──────────────────────────────────────┘

  最佳实践：
    - 始终在笔记第一行写 # 标题，确保标题明确
    - 标题尽量简短且具有辨识度（太长不利于 [[wikilink]] 引用）
    - 修改标题后建议执行 lo sync --wikilinks 重建链接索引
    - 避免在笔记中写多个 # heading（只会取第一个，其余的不会影响 title）
    - 标题不要包含 | 字符，否则 [[...]] 别名语法会解析异常

  字数统计（wordCount）：
    - 仅对 note 类型自动提取，按空白字符分割后计数
    - ResourceService._extractMetadata 实现: content.split(/\\s+/).filter(w => w.length > 0).length
    - 存储于 metadata.wordCount，写入时校验为整数 >= 0
    - 可通过 lo show 查看，lo list 中作为一列显示`);

    console.log(chalk.bold.yellow('\n  四、笔记的状态系统'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  每条笔记有三种状态：

    ┌──────────┬────────────────────────────────────────┐
    │  状态     │  含义                                  │
    ├──────────┼────────────────────────────────────────┤
    │  draft    │  草稿 — 正在编写中，尚未完成             │
    │ published │  已发布 — 内容已完成，可公开引用         │
    │  archived │  已归档 — 不再活跃修改，仅保留查阅        │
    └──────────┴────────────────────────────────────────┘

  状态的作用：
    - lo list --status draft      只列出草稿笔记
    - lo list --status published  只列出已完成笔记
    - lo list --status archived   只列出归档笔记
    - 过滤搜索时可按状态筛选

  典型工作流：
    新建 → draft → 完成编辑 → published → 不再需要 → archived`);

    console.log(chalk.bold.yellow('\n  五、笔记的标签与分类'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  标签 (Tags) 和分类 (Category) 是两种不同的组织方式：

  ┌──────────┬────────────────────┬───────────────────────────┐
  │  维度     │  标签 (tag)         │  分类 (category)           │
  ├──────────┼────────────────────┼───────────────────────────┤
  │  数量     │  多条（数组）       │  一条（唯一）               │
  │  含义     │  交叉维度、自由标注  │  归属、文件夹式层级分类      │
  │  类比     │  Gmail 标签         │  文件路径 (父/子/孙)       │
  │  命令     │  lo tag add/rm/list │  lo category set/rm/list   │
  │          │                    │       /tree                 │
  └──────────┴────────────────────┴───────────────────────────┘

  分类支持多级层级（用 / 分隔）：
    - 单级: 编程
    - 多级: 编程/Python/爬虫
    - lo category tree 以树形图展示父子层级关系

  默认分类（自动分配）：
    - 笔记类型（note）创建时自动归入默认分类，默认为 "未分类"
    - 非笔记类型（图片、PDF 等）自动归入 "其他资源"
    - 可通过 lo config 修改默认值:
        lo config add category.defaultNote "我的笔记"
        lo config add category.defaultOther "附件"
    - 显式指定 --category 时始终优先于默认值

  使用建议：
    - 标签: 用于跨分类的主题标注，如 "前端"、"性能优化"、"待复习"
    - 分类: 用于笔记的层级归属，如 "编程/Python"、"读书笔记/文学"
    - 多级分类适合精细化组织，但不宜过深（建议 1-3 级）

  内联标签语法（在笔记内容中）：
    在笔记正文中写 #标签名 即可创建标签
    例如: 这是一条关于 #React 和 #性能优化 的笔记
    lo sync 会自动从内容中提取标签并写入数据库

  操作示例：
    lo tag add res_abc 前端              为笔记添加"前端"标签
    lo tag rm res_abc 性能优化            移除"性能优化"标签
    lo tag list res_abc                  列出笔记的所有标签
    lo category set res_abc 编程          将笔记归入"编程"分类
    lo category set res_abc 编程/Python   归入多级分类
    lo category rm res_abc               移除笔记的分类
    lo category list res_abc             查看当前分类
    lo category list                     列出所有分类（扁平）
    lo category tree                     树形展示父子层级
    lo list --tag 前端                   列出所有带"前端"标签的笔记
    lo list --category 编程              列出所有"编程"分类的笔记`);

    console.log(chalk.bold.yellow('\n  六、笔记的 CRUD 操作'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  完整的笔记生命周期管理:

  ┌────────┬──────────────────────┬──────────────────────────────┐
  │  操作   │  命令                 │  说明                        │
  ├────────┼──────────────────────┼──────────────────────────────┤
  │  创建   │  lo new "标题"        │  创建一篇新笔记               │
  │        │  lo new "标题" --tags  │  创建时指定标签              │
  │        │      "前端,React"      │                              │
  │        │  lo new "标题"         │  创建时指定多级分类          │
  │        │      --category 编程/   │                              │
  │        │      Python/爬虫        │                              │
  │        │  lo new "标题"         │  使用自定义模板              │
  │        │      --template daily  │                              │
  │        │  lo import path/to/    │  从外部导入 .md 文件         │
  │        │      file.md           │                              │
  ├────────┼──────────────────────┼──────────────────────────────┤
  │  查看   │  lo show res_xxx      │  查看笔记内容（格式化）       │
  │        │  lo show res_xxx --raw │  查看笔记原始 Markdown       │
  │        │  lo list               │  列出所有笔记（默认 20 条）   │
  │        │  lo list --type note   │  仅列出笔记类型              │
  │        │  lo list --limit 50    │  列出最近 50 条              │
  ├────────┼──────────────────────┼──────────────────────────────┤
  │  编辑   │  lo edit res_xxx      │  用默认编辑器打开笔记         │
  │        │  lo edit res_xxx       │  用指定编辑器打开             │
  │        │      --editor code     │                              │
  ├────────┼──────────────────────┼──────────────────────────────┤
  │  删除   │  lo delete res_xxx    │  软删除（可恢复）             │
  │        │  lo delete res_xxx     │  硬删除（永久删除）           │
  │        │      --hard            │                              │
  │        │  lo delete res_xxx     │  跳过确认直接删除            │
  │        │      --force           │                              │
  ├────────┼──────────────────────┼──────────────────────────────┤
  │  移动   │  lo move res_xxx      │  移动笔记到指定路径           │
  │        │      resources/新目录   │                              │
  ├────────┼──────────────────────┼──────────────────────────────┤
  │  搜索   │  lo find "关键词"     │  全文模糊搜索笔记             │
  │        │  lo find "关键词"      │  搜索结果限制数量            │
  │        │      --limit 5         │                              │
  │        │  lo find "关键词"      │  仅搜索特定类型              │
  │        │      --type note       │                              │
  └────────┴──────────────────────┴──────────────────────────────┘

  创建笔记时的内部流程：
    1. lo new "理解闭包"
    2. slugify("理解闭包") → "li-jie-bi-bao"
    3. date → "2026-07-05"
    4. 文件名 → "2026-07-05-li-jie-bi-bao.md"
    5. 写入内容 → "# 理解闭包\\n\\n开始写作...\\n"
    6. 计算 SHA-256 散列
    7. 分配到 RID (crypto.randomBytes → res_xxx)
    8. INSERT INTO resources (...)
    9. 打印: ✓ 笔记已创建: res_xxx → resources/2026-07-05-li-jie-bi-bao.md`);

    console.log(chalk.bold.yellow('\n  七、模板系统'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  lo 支持使用模板快速创建笔记。

  内置模板：

    default  默认模板             daily  日记模板
    ───────── ────────────────    ─────  ────────────────
    # {{title}}                   # {{date}} 日记
                                  ## 今日完成
    开始写作...                    -
                                  ## 待办事项
                                  - [ ]
                                  ## 想法记录

  使用模板：
    lo new "新笔记" --template default    使用默认模板
    lo new "日记" --template daily        使用日记模板

  自定义模板：
    模板文件存放在 templates/ 目录中，支持以下变量：
      {{title}}    标题（创建时传入的标题参数）
      {{date}}     当前日期 (YYYY-MM-DD)
      {{time}}     当前时间 (HH:MM:SS)
      {{datetime}} 完整日期时间

    可以创建自己的模板文件，例如：
      templates/meeting.md.template   会议记录模板
      templates/review.md.template    复习笔记模板

    使用自定义模板：
      lo new "周会记录" --template meeting`);

    console.log(chalk.bold.yellow('\n  八、日记功能'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  日记是 lo 的特色功能之一，用于快速创建每日记录。

    lo daily

  执行 lo daily 后会：
    1. 使用日记模板 (templates/daily.md.template)
    2. 替换 {{date}} 为当天日期
    3. 生成文件名: YYYY-MM-DD-ri-ji.md
    4. 自动加入"日记"分类和"daily"标签

  日记内容模板：
    # 2026-07-05 日记

    ## 今日完成
    -

    ## 待办事项
    - [ ]

    ## 想法记录

  日记的用途：
    - 每日工作记录
    - 学习笔记汇总
    - 想法随手记
    - 周/月回顾的素材来源

  提示：
    - 同一天多次执行 lo daily 会复用已有日记（不重复创建）
    - 日记也是普通笔记，支持标签、搜索、wikilink 等所有功能`);

    console.log(chalk.bold.yellow('\n  九、笔记间的链接'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  lo 支持两种方式建立笔记间的关系：

  方式一：[[wikilink]] 语法（推荐）
  ─────────────────────────────────
    在笔记中使用 [[...]] 语法自动建立双向链接：

    RID 方式（推荐，精确无歧义）:
    笔记A.md:                    笔记B.md:
    # React 基础                  # React Hooks
    学习 [[res_xxx]] 之前         参考 [[res_yyy|基础篇]]
    需要先掌握基础概念。

    标题方式（注意标题重复风险）:
    笔记A.md:                    笔记B.md:
    # React 基础                  # React Hooks
    学习 [[React Hooks]] 之前     参考 [[React 基础|基础篇]]

    lo sync 后自动建立双向关系：
    A → B (wikilink)
    B → A (反向链接，自动维护)

  方式二：手动链接 (lo link)
  ─────────────────────────────────
    lo link res_abc res_def            建立引用关系
    lo link res_abc res_def --type tag 建立标签关系
    lo unlink res_abc res_def          解除关系

  区别：
    ┌──────────┬──────────────────────┬─────────────────────┐
    │  维度     │  [[wikilink]]         │  lo link             │
    ├──────────┼──────────────────────┼─────────────────────┤
    │  触发方式  │  写在 .md 文件中       │  命令行手动执行       │
    │  解析时机  │  lo sync 时自动       │  即时执行            │
    │  适用文件  │  仅 .md 文件          │  所有类型资源         │
    │  链接类型  │  wikilink             │  reference / tag    │
    │  双向链接  │  自动创建             │  需手动创建          │
    │  断开方式  │  删除 [[...]] 后 sync  │  lo unlink          │
    └──────────┴──────────────────────┴─────────────────────┘

  更多详情：lo docs wikilink`);

    console.log(chalk.bold.yellow('\n  十、笔记的版本控制'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  笔记支持类似 Git 的版本控制工作流：

    ┌─────────┐    lo add    ┌──────────┐   lo commit   ┌──────────┐
    │  工作目录  │ ──────────► │  暂存区   │ ────────────► │  提交历史  │
    │ (文件系统) │             │ staging   │               │ commits  │
    └─────────┘             └──────────┘               └──────────┘

  日常流程示例：

    # 创建笔记
    lo new "我的学习笔记"

    # 在编辑器中修改笔记内容...

    # 查看变更
    lo status
    → 未暂存修改:
        修改: resources/2026-07-05-wo-de-xue-xi-bi-ji.md

    # 加入暂存区
    lo add resources/2026-07-05-wo-de-xue-xi-bi-ji.md

    # 查看暂存差异
    lo diff

    # 提交（数据库记录新散列和新元数据）
    lo commit -m "完成第一版学习笔记"

    # 查看历史
    lo log

  暂存区支持的操作：
    - 内容变更（修改文件内容）
    - 元数据变更（添加/移除标签、修改分类）
    - 删除操作（lo rm 暂存删除）
    - 重命名检测（自动匹配散列识别文件移动）

  更多详情：lo docs version`);

    console.log(chalk.bold.yellow('\n  十一、笔记的加密'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  笔记内容可以选择端到端加密保护。

  加密后的笔记：
    - 磁盘上存储为 LOEC 二进制密文（非明文 Markdown）
    - 只有持有 RepoKey 的人能解密读取
    - 文件名和路径不变，方便管理
    - 数据库仍存储明文散列（用于变更检测）

  加密状态：
    lo list 中加密笔记会标记 🔒
    lo show 加密笔记需要先通过认证

  启用加密的前提：
    1. lo init 生成 RepoKey
    2. lo auth add 绑定 SSH 密钥保护 RepoKey

  更多详情：lo docs encryption`);

    console.log(chalk.bold.yellow('\n  十二、常用命令速查'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
    lo new "标题"                   创建笔记（自动默认分类）
    lo new "标题" --tags "a,b"      创建笔记并添加标签
    lo new "标题" --category 编程/   创建笔记并设置多级分类
    Python/爬虫
    lo daily                        创建今日日记
    lo list                         列出最近 20 条笔记
    lo list --status draft          列出草稿
    lo list --tag 前端              按标签过滤
    lo show res_xxx                 查看笔记
    lo show res_xxx --raw           查看原始 Markdown
    lo edit res_xxx                 编辑笔记
    lo find "关键词"                 搜索笔记
    lo delete res_xxx               删除笔记
    lo import path/to/file.md       导入笔记
    lo tag add res_xxx 标签名       添加标签
    lo category set res_xxx 编程     设置分类
    lo category set res_xxx 编程/    设置多级分类
    Python
    lo category list                列出所有分类
    lo category tree                树形展示分类层级
    lo sync                         同步文件到数据库
    lo sync --wikilinks             同步并重建 wikilink
    lo link res_a res_b             建立笔记间链接
    lo move res_xxx 目标路径         移动笔记
    lo stats                        查看统计
    lo stats --today                今日统计
    lo manual new                   查看 new 命令手册`);
};
