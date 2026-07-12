const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  架构分析'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    // ============================================================
    // 一、概览
    // ============================================================
    console.log(chalk.bold.yellow('\n  一、架构全景'));
    console.log(`
  lo 是一个本地优先、端到端加密的资源管理工具。所有逻辑在客户端，
  远程只是一个通过 SSH 访问的裸目录。

  ┌─────────────────────────────────────────────────────────────┐
  │                       lo 系统架构（Phase 6.x）                 │
  │                                                              │
  │  ┌─────────┐    ┌──────────────────────────────────────┐    │
  │  │ CLI     │    │           Repository                  │    │
  │  │(cli.cjs)│───│       (repository.cjs)                 │    │
  │  └─────────┘    │                                       │    │
  │                  │  ┌─────────────────────────────────┐ │    │
  │                  │  │  核心服务层                       │ │    │
  │                  │  │  ResourceService / RelationService│ │    │
  │                  │  │  QueryEngine / SyncOpsEngine     │ │    │
  │                  │  │  StagingArea / ContainerService  │ │    │
  │                  │  ├─────────────────────────────────┤ │    │
  │                  │  │  Phase 6 扩展系统                 │ │    │
  │                  │  │  PluginManager / EventBus        │ │    │
  │                  │  │  WorkflowEngine / PermissionEngine│ │    │
  │                  │  │  AgentEngine / CollaborationEngine│ │    │
  │                  │  │  AIOSKernel / EvolutionEngine    │ │    │
  │                  │  ├─────────────────────────────────┤ │    │
  │   ┌────────────┐ │  │  Knowledge Graph                 │ │    │
  │   │ HTTP API   │ │  │  GraphEngine / FederatedGraph   │ │    │
  │   │(serve.cjs) │─│  │  SuggestionEngine / AutoPipeline │ │    │
  │   └────────────┘ │  └───────────────┬─────────────────┘ │    │
  │                  │                  │                    │    │
  │                  │           ┌──────┴──────┐             │    │
  │                  │           │  Database   │             │    │
  │                  │           │  (SQLite)   │             │    │
  │                  │           └─────────────┘             │    │
  │                  └──────────────────────────────────────┘    │
  │                            │                                 │
  │              ┌─────────────┼─────────────┐                  │
  │              ▼             ▼             ▼                  │
  │        resources/    .repo/keys/    sync_batches/           │
  │        (资源文件)     (加密密钥)     (远程同步批次)           │
  └─────────────────────────────────────────────────────────────┘

  核心设计原则：
    - 本地优先：所有数据以明文存储在本机，离线完全可用
    - 端到端加密：中继服务器只能看到密文，无法解密内容
    - 操作日志复制：同步的不是数据库文件，而是可重放的操作日志
    - 不可变 RID：资源 ID 基于创建时间和随机数，永不改变
    - 资源平等：所有文件都是资源（笔记、图片、PDF 等），类型只是属性之一`);

    // ============================================================
    // 二、数据存储层
    // ============================================================
    console.log(chalk.bold.yellow('\n  二、数据存储层（三层 + 两派生）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`

  ┌─────────────────────────────────────────────────────────────┐
  │  第一层：文件系统 — 资源文件本体                              │
  ├─────────────────────────────────────────────────────────────┤
  │                                                              │
  │  位置：resources/                                            │
  │  内容：.md 笔记、图片、PDF、视频、JSON、HTML 等所有资源        │
  │  命名：YYYY-MM-DD-slug.md（笔记）、原始文件名（导入文件）      │
  │  格式：未加密时即原始内容；加密时以 LOEC 格式包装              │
  │                                                              │
  │  文件类型枚举（src/utils/resourceType.cjs）：                  │
  │    note  image  pdf  video  audio  html  text  json           │
  │    document  spreadsheet  presentation  archive               │
  │    drawing  code  unknown                                     │
  │                                                              │
  │  目录结构示例：                                               │
  │    resources/                                                │
  │    ├── 2026-07-05-bi-ji.md               ← 笔记文件          │
  │    ├── 2026-07-05-zhao-pian.jpg           ← 图片文件          │
  │    └── subdir/                            ← 支持子目录        │
  │        └── 2026-07-06-zi-bi-ji.md                            │
  │                                                              │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  第二层：SQLite — 结构化元数据                                │
  ├─────────────────────────────────────────────────────────────┤
  │                                                              │
  │  位置：.repo/database.sqlite                                  │
  │  驱动：sqlite3（Node.js 原生绑定，非 better-sqlite3）          │
  │                                                              │
  │  表结构（共 6 张表）：                                        │
  │                                                              │
  │  ┌─────────────┬──────────────────────────────────────────┐  │
  │  │  表名         │  用途                                    │  │
  │  ├─────────────┼──────────────────────────────────────────┤  │
  │  │  resources   │  主表：所有资源的索引                     │  │
  │  │  relations   │  [[wikilink]] 双向链接图                  │  │
  │  │  sync_ops    │  操作日志：同步的基本单位                 │  │
  │  │  sync_config │  KV 配置（设备ID、锚点、远程别名）         │  │
  │  │  commits     │  版本提交历史（谁/何时/做了什么）         │  │
  │  │  sync_log    │  同步活动审计日志                         │  │
  │  └─────────────┴──────────────────────────────────────────┘  │
  │                                                              │
  │  resources 表完整列：                                         │
  │                                                              │
  │    rid          TEXT PRIMARY KEY    资源唯一标识              │
  │    type         TEXT                资源类型（如 'note'）     │
  │    path         TEXT                文件相对路径              │
  │    hash         TEXT                明文 SHA-256（变更检测）  │
  │    metadata     TEXT                JSON 元数据（严格校验）   │
  │    encrypted    INTEGER             是否加密 (0/1)           │
  │    created      INTEGER             创建时间戳 (ms)          │
  │    updated      INTEGER             最后修改时间戳 (ms)      │
  │    deleted      INTEGER             是否软删除 (0/1)         │
  │                                                              │
  │  索引：                                                       │
  │    - resources(type)  按类型过滤                              │
  │    - resources(path)  按路径查找                              │
  │    - sync_ops(timestamp)  按时间查询操作日志                   │
  │    - sync_ops(device_id)  按设备过滤操作                      │
  │    - relations(from_rid, to_rid, type)  唯一约束              │
  │                                                              │
  │  注意：                                                       │
  │    - 未开启 WAL 模式（默认 rollback journal）                  │
  │    - 未设置 PRAGMA busy_timeout                              │
  │    - 无 full-text search (FTS) 索引                          │
  │    - 无 resources(hash) 索引                                  │
  │    - metadata 是 JSON 字符串列，不可在 SQL 中按子字段过滤      │
  │                                                              │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  第三层：内存 — 临时运行时状态                                 │
  ├─────────────────────────────────────────────────────────────┤
  │                                                              │
  │  当前的内存缓存（非常有限）：                                  │
  │                                                              │
  │  缓存的项                    过期/清理策略                    │
  │  ────────────────────────   ────────────────────────────────  │
  │  解密密钥 (RepoKey)          repo.close() 时清零              │
  │  HTTP session token         60 分钟 TTL，每 5 分钟清理        │
  │  SSH 认证 nonce 挑战         5 分钟 TTL                       │
  │  设备 ID                     持久化到 sync_config             │
  │                                                              │
  │  明确不存在但可能有用的缓存：                                  │
  │    - 无资源列表 LRU 缓存（每次都查 SQLite）                    │
  │    - 无文件内容缓存（每次读都走 fs.readFile + 解密）           │
  │    - 无 glob 结果缓存（每次 sync 都重新扫描文件系统）          │
  │    - 无 wikilink 解析索引（每次解析都遍历全表）                │
  │                                                              │
  └─────────────────────────────────────────────────────────────┘

  派生层 A：暂存区（StagingArea）
  ────────────────────────────────────────────────────────
    位置：.repo/staging.json
    用途：Git 式的暂存区，收集 add/rm/tag/category 操作后批量 commit
    格式：{ added: [], modified: [], deleted: [], renamed: [], metadata: [] }
    生命周期：commit 后清空

  派生层 B：同步批次（Sync Batches）
  ────────────────────────────────────────────────────────
    位置：远程服务器的 sync_batches/ 目录
    用途：多设备之间传输变更
    格式：batch_<timestamp>.tar.gz
    内含：manifest.json + ops.json + checksums.json + resources/
    生命周期：作为历史保留（clone 需要所有批次）`);

    // ============================================================
    // 三、核心类关系
    // ============================================================
    console.log(chalk.bold.yellow('\n  三、核心类关系'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`

  Repository 是所有服务的聚合入口：

  ┌─────────────────────────────────────────────────────────────┐
  │  Repository (src/repo/repository.cjs)                        │
  │                                                              │
  │  this.db         → Database      SQLite 连接管理              │
  │  this.resources  → ResourceService 资源 CRUD                  │
  │  this.relations  → RelationService 双向链接                   │
  │  this.syncOps    → SyncOpsEngine  操作日志引擎               │
  │  this.query      → QueryEngine   搜索与列表                   │
  │  this.staging    → StagingArea   提交暂存区                   │
  │  this.watcher    → FileWatcher   文件系统监听                 │
  │                                                              │
  │  // Phase 6 扩展系统 (6.1~6.8)                                 │
  │  this.pluginManager   → PluginManager     插件管理 (6.1)     │
  │  this.eventBus        → EventBus          事件总线 (6.2)     │
  │  this.workflowEngine  → WorkflowEngine    工作流引擎 (6.3)   │
  │  this.permissionEngine→ PermissionEngine  权限系统 (6.4)      │
  │  this.agentEngine     → AgentEngine       智能体引擎 (6.5)   │
  │  this.collaborationEngine → CollabEngine  协作引擎 (6.6)     │
  │  this.aiOS            → AIOSKernel       AI OS 内核 (6.7)   │
  │  this.evolutionEngine → EvolutionEngine   演化引擎 (6.8)     │
  │                                                              │
  │  // 知识图谱子系统                                            │
  │  this.graphEngine     → GraphEngine      关系图查询引擎       │
  │                                                              │
  │  生命周期：                                                   │
  │    open()         打开已有仓库，验证密钥                       │
  │    init()         创建新仓库，初始化数据库 + 扩展系统          │
  │    close()        清理密钥，关闭数据库 + 卸载扩展系统          │
  │    startWatcher() 启动文件监听                                │
  │    sync()         扫描文件系统 → 更新 DB → 生成操作日志      │
  └─────────────────────────────────────────────────────────────┘

  数据写入流（以"创建笔记"为例）：

    CLI: lo new "标题"
      │
      ▼
    Repository.createNote(title, content, tags, category)
      │
      ▼
    ResourceService.create({ title, tags, category })
      ├── _writeFile(path, encrypted_content)     → resources/xxx.md
      ├── assertMetadata(metadata)                → 校验通过
      ├── db.run(INSERT INTO resources ...)       → SQLite
      └── SyncOpsEngine.recordOp(RESOURCE_CREATED) → sync_ops 表
      │
      ▼
    (如果是 commit 工作流)
    StagingArea.commit()
      ├── syncOps.recordOp(RESOURCE_UPDATED, ...) → 元数据变更
      └── db.run(INSERT INTO commits ...)         → 提交记录

  数据读取流（以"lo show"为例）：

    CLI: lo show res_xxx
      │
      ▼
    Repository.getResource(rid)
      │
      ▼
    ResourceService.get(rid)
      ├── db.get(SELECT * FROM resources WHERE rid = ?)  → 元数据
      └── _readFile(path)                               → 文件内容
            └── 检测 LOEC magic → 解密 → 返回明文`);

    // ============================================================
    // 四、Phase 6 扩展系统总览
    // ============================================================
    console.log(chalk.bold.yellow('\n  四、Phase 6 扩展系统总览（已实现）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`

  lo 的 Phase 6 系列已将以下扩展系统从设计阶段落地为正式实现：

  ┌─────────────────────────────────────────────────────────────┐
  │  Phase 6.1 — 插件系统 (PluginManager)                        │
  │    - 插件生命周期管理 (load/init/activate/deactivate/unload) │
  │    - 扩展点注册 (hook/route/command/transformer/validator)   │
  │    - 上下文隔离，插件 crash 不影响核心                       │
  │    命令: lo plugin list/enable/disable/reload/info           │
  ├─────────────────────────────────────────────────────────────┤
  │  Phase 6.2 — 事件总线 (EventBus)                             │
  │    - 发布-订阅模式，支持中间件链                             │
  │    - 事件持久化到 SQLite，支持 replay                        │
  │    - 资源/关系/同步/系统事件全覆盖                           │
  │    命令: lo event list/history/listeners/replay              │
  ├─────────────────────────────────────────────────────────────┤
  │  Phase 6.3 — 工作流引擎 (WorkflowEngine)                     │
  │    - 步骤模型 (action/condition/loop/parallel/wait/script)   │
  │    - 条件引擎 + 调度器 (manual/scheduled/event-driven)       │
  │    命令: lo workflow list/run/status/history                 │
  ├─────────────────────────────────────────────────────────────┤
  │  Phase 6.4 — 权限系统 (PermissionEngine)                     │
  │    - RBAC+ABAC 混合模型                                      │
  │    - 资源级 ACL + 审计日志                                   │
  │    命令: lo permission role/check/grant/audit                │
  ├─────────────────────────────────────────────────────────────┤
  │  Phase 6.5 — 知识智能体 (AgentEngine)                        │
  │    - 多类型 Agent (researcher/curator/analyst/monitor/assistant)│
  │    - 状态机 + 三层记忆 + 规划/执行/反思循环                  │
  │    命令: lo agent list/info/run/memory/messages/send         │
  ├─────────────────────────────────────────────────────────────┤
  │  Phase 6.6 — 多智能体协作 (CollaborationEngine)              │
  │    - 团队模型 (Leader/Member)                                │
  │    - 消息总线 + 任务系统 + 共享记忆                          │
  │    命令: lo team list/run                                    │
  ├─────────────────────────────────────────────────────────────┤
  │  Phase 6.7 — AI 原生知识 OS (AIOSKernel)                     │
  │    - 模型网关 + 推理引擎 (chat/analysis/research/creation)    │
  │    - 语义记忆 + 概念记忆 + 学习引擎                          │
  │    命令: lo ai status/ask/analyze/insights/memory            │
  ├─────────────────────────────────────────────────────────────┤
  │  Phase 6.8 — 知识系统自演化 (EvolutionEngine)                │
  │    - OODA 循环 (Observe/Analyze/Detect/Plan/Execute/Validate) │
  │    - 健康度分析 + 进化检测 + 策略生成 + 执行验证             │
  │    - evolution_states/actions/history 三表                   │
  │    命令: lo evolution status/analyze/run/history             │
  └─────────────────────────────────────────────────────────────┘

  知识图谱子系统（Phase 5.x）：

  ┌─────────────────────────────────────────────────────────────┐
  │  Phase 5.7  — 知识分析、缺口检测、智能推荐                   │
  │  Phase 5.8  — AI 辅助知识图谱 (SuggestionEngine)             │
  │  Phase 5.9  — 知识自动化管线 (AutoPipeline)                  │
  │  Phase 5.10 — 联邦知识图谱 (FederatedGraph/GlobalRID)        │
  │  Phase 5.11 — 知识演化与模式检测 (Hub/Chain/Bridge/Dead-end) │
  │                                                              │
  │  命令: lo knowledge/suggestion/automation/federation/graph   │
  └─────────────────────────────────────────────────────────────┘`);

    // ============================================================
    // 五、已实现的模块协议参考
    // ============================================================
    console.log(chalk.bold.yellow('\n  五、模块协议参考（已在 Phase 6.1 中实现）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.cyan('\n  5.1 设计目标'));
    console.log(`
  让 lo 的笔记数据驱动上层应用（如文本游戏、仪表盘、自动发布等），
  模块与核心松耦合，可独立开发、独立加载、独立失败。

  关键原则：
    - 模块不应修改核心代码，只通过注入的 API 交互
    - 一个模块崩溃不影响其他模块或核心功能
    - 模块可以声明关心的资源类型，过滤无关数据
    - 模块可以注册自己的 HTTP 端点，与 lo serve 共存`);

    console.log(chalk.cyan('\n  5.2 基础设施一：事件总线'));
    console.log(`
  在 Repository 上挂载一个 EventEmitter，作为所有模块的数据入口。

  事件分类：

  资源层事件（精细粒度）—— 模块最常用的数据来源：

    resource:created  → { rid, type, path, metadata }
      触发时机：lo new、lo import、lo sync 发现新文件、HTTP POST /api/notes
      示例用途：文字游戏模块检测到新"场景"笔记，自动生成连接

    resource:updated  → { rid, type, path, metadata, oldHash, changeType }
      触发时机：lo edit、HTTP PUT /api/notes/:rid、lo sync 检测到 hash 变化
      changeType: 'content' | 'metadata' | 'both'
      示例用途：仪表盘模块更新统计、游戏模块重载被修改的场景

    resource:deleted  → { rid, type, path }
      触发时机：lo delete、HTTP DELETE /api/notes/:rid、软删除
      示例用途：自动备份模块记录删除历史

    resource:tagged   → { rid, tags }
      触发时机：lo tag add/rm
      示例用途：标签驱动的发布模块将"publish"标签的笔记推到博客

    relation:created  → { from_rid, to_rid, type }
    relation:deleted  → { from_rid, to_rid, type }
      触发时机：[[wikilink]] 解析建立/删除链接
      示例用途：知识图谱模块更新图结构

  同步层事件（粗粒度）：

    sync:before-push  → { remote, opCount }
    sync:after-push   → { remote, batchId, opCount, duration }
    sync:before-pull  → { remote }
    sync:after-pull   → { remote, fileCount, opCount, conflictCount, duration }
      示例用途：通知模块在拉取后重建索引

  生命周期事件：

    repo:opened       → { repoPath }
    repo:closing      → { repoPath }
      示例用途：模块初始化 / 清理资源

  设计约束：
    - 事件只携带最小数据（rid 而非整个 resource 对象），模块按需调用 repo API
    - 事件监听器抛错不阻塞后续监听器（try-catch 包装）
    - 事件名称使用命名空间化字符串（不引入 Symbol / 枚举依赖）`);

    console.log(chalk.cyan('\n  5.3 基础设施二：模块协议'));
    console.log(`
  每个模块是 modules/ 下的一个目录，包含 manifest.json 和入口文件：

    modules/
    └── text-game/
        ├── manifest.json      # 模块声明
        ├── index.cjs          # 入口文件（模块协议实现）
        ├── rooms/             # 模块内部文件（任意结构）
        └── README.md          # 可选：模块说明

  manifest.json 规范：

    {
      "id": "text-game",               // 唯一标识，用于去重
      "name": "文字冒险游戏引擎",        // 人类可读
      "version": "1.0.0",              // 语义化版本
      "description": "基于笔记数据的交互式文字游戏",
      "author": "...",
      "main": "index.cjs",             // 入口文件名（默认 index.cjs）
      "resourceTypes": ["note"],       // 关心的资源类型（不声明 = 全部）
      "dependencies": {}               // 保留：未来的模块间依赖
    }

  模块协议（ModuleProtocol v1）：

    module.exports = {
      // ===== 必需：模块标识 =====
      id: 'text-game',
      version: '1.0.0',

      // ===== 可选：生命周期钩子 =====
      //
      // async onLoad(repo: Repository): void
      //   repo 打开后调用。模块在此：
      //     - 订阅事件 (repo.events.on(...))
      //     - 加载存量数据 (repo.resources.list / repo.query.search)
      //     - 初始化内部状态
      //     - 注册 HTTP 路由 (repo.registerRoute(...))
      //
      async onLoad(repo) {
        // 订阅创建/更新事件
        repo.events.on('resource:created', (e) => this.handleNew(e));
        repo.events.on('resource:updated', (e) => this.handleUpdate(e));
      },

      // async onUnload(): void
      //   repo 关闭前调用。模块在此：
      //     - 取消事件订阅
      //     - 保存状态到磁盘
      //     - 关闭网络连接
      //
      async onUnload() {
        // 清理
      },

      // ===== 可选：资源类型过滤器 =====
      resourceTypes: ['note'],
    };

  错误处理约定：
    - onLoad 抛错 → 模块标记为"加载失败"，记录日志，不影响核心
    - onUnload 抛错 → 记录日志，继续执行后续模块的卸载
    - 事件处理函数抛错 → 记录日志，不阻止其他监听器`);

    console.log(chalk.cyan('\n  5.4 基础设施三：模块加载器'));
    console.log(`
  在 Repository.open() 完成后自动扫描和加载模块：

    // src/modules/loader.cjs（新增文件）
    async function loadModules(repo, modulesDir) {
      const dirs = fs.readdirSync(modulesDir, { withFileTypes: true })
        .filter(d => d.isDirectory());

      for (const dir of dirs) {
        try {
          const manifest = JSON.parse(
            fs.readFileSync(path.join(modulesDir, dir.name, 'manifest.json'))
          );
          const mod = require(path.join(modulesDir, dir.name, manifest.main || 'index.cjs'));

          // 注入 repo 引用并调用生命周期
          if (mod.onLoad) {
            await mod.onLoad(repo);
          }

          loadedModules.set(mod.id, mod);
          repo.logger.info(\`模块已加载: \${mod.id} v\${mod.version}\`);
        } catch (err) {
          repo.logger.error(\`模块加载失败: \${dir.name} — \${err.message}\`);
          // 继续加载下一个模块
        }
      }
    }

  在 Repository.close() 中注册卸载：

    async close() {
      for (const [id, mod] of loadedModules) {
        try {
          if (mod.onUnload) await mod.onUnload();
        } catch (err) {
          this.logger.error(\`模块卸载失败: \${id} — \${err.message}\`);
        }
      }
      // ... 其余清理
    }

  加载时机：
    - Repository.open() 完成后 → 加载所有 modules/ 下的模块
    - Repository.init() 完成后 → 同上（首次创建仓库）
    - lo serve 启动时 → 通过 Repository 实例，间接包含模块

  热重载（未来）：
    - 监听 modules/ 目录的 manifest.json 变化
    - onUnload 旧版本 → require.cache 清除 → 重新 require → onLoad 新版本`);

    console.log(chalk.cyan('\n  5.5 基础设施四：模块 HTTP 路由注册'));
    console.log(`
  模块可以通过 repo.registerRoute() 注册自己的 HTTP 端点，
  与 lo serve 的核心端点在同一个服务中共存：

    // 模块在 onLoad 中注册
    async onLoad(repo) {
      repo.registerRoute('GET', '/api/game/state', async (req, res) => {
        const state = this.getGameState();
        return { status: 200, body: state };
      });

      repo.registerRoute('POST', '/api/game/action', async (req, res) => {
        const { action, params } = await parseJsonBody(req);
        const result = this.processAction(action, params);
        return { status: 200, body: result };
      });
    }

  路由注册实现（在 serve.cjs 中扩展）：

    // 将硬编码的 route() 改为同时写入模块路由表
    const MODULE_ROUTES = { GET: new Map(), POST: new Map(), ... };

    function handleRequest(req, res) {
      // 先查核心路由，再查模块路由
      const routes = ALL_ROUTES[req.method];
      const match = routes.get(url.pathname) || MODULE_ROUTES[req.method].get(url.pathname);
      ...
    }

  模块路由安全：
    - 模块路由与核心路由共享同一认证层（如果开启）
    - 模块无法覆盖核心路由（先查核心路由）
    - 模块路由使用独立命名空间（建议 /api/<module-id>/...）`);

    console.log(chalk.cyan('\n  5.6 模块示例：最小文字游戏模块'));
    console.log(`
  以下是一个极简示例，展示模块如何利用笔记数据驱动游戏：

    // modules/text-game/index.cjs
    module.exports = {
      id: 'text-game',
      version: '1.0.0',
      resourceTypes: ['note'],

      async onLoad(repo) {
        this.repo = repo;
        this.rooms = new Map();  // rid → 游戏房间状态

        // 加载已存在的游戏房间
        const notes = await repo.resources.list({ type: 'note' });
        for (const n of notes) {
          if (n.metadata.tags?.includes('game-room')) {
            this.rooms.set(n.rid, this.parseRoom(n));
          }
        }

        // 订阅新内容事件
        repo.events.on('resource:created', ({ rid }) => {
          const res = repo.resources.get(rid);
          if (res.metadata?.tags?.includes('game-room')) {
            this.rooms.set(rid, this.parseRoom(res));
          }
        });

        repo.events.on('resource:updated', ({ rid }) => {
          const res = repo.resources.get(rid);
          if (this.rooms.has(rid)) {
            this.rooms.set(rid, this.parseRoom(res));
          }
        });

        repo.events.on('resource:deleted', ({ rid }) => {
          this.rooms.delete(rid);
        });

        // 注册 HTTP 端点
        repo.registerRoute('GET', '/api/game/rooms', async () => ({
          status: 200,
          body: Array.from(this.rooms.values())
        }));

        repo.registerRoute('GET', '/api/game/rooms/:rid', async (req, ctx) => {
          const room = this.rooms.get(ctx.params.rid);
          return room
            ? { status: 200, body: room }
            : { status: 404, body: { error: '房间不存在' } };
        });
      },

      parseRoom(resource) {
        // 把 Markdown 笔记内容解析为游戏房间
        // 约定格式：
        //   # 房间名称
        //   ## description
        //   你站在一个黑暗的房间里...
        //   ## exits
        //   - north: res_xxx
        //   - south: res_yyy
        const content = resource.content;
        // ... 解析逻辑 ...
      }
    };

  使用场景：

    # 1. 用 lo new 创建游戏房间
    lo new "黑暗森林"
    lo edit res_xxx  # 编写场景描述、出口、物品

    # 2. 打上标签，让模块识别
    lo tag add game-room res_xxx

    # 3. 模块自动检测到新的 game-room 标签
    #    解析笔记内容，构建游戏世界

    # 4. 通过 HTTP API 与游戏交互
    curl http://127.0.0.1:8765/api/game/rooms
    # → [{ rid: "res_xxx", name: "黑暗森林", exits: [...] }, ...]

  这个模式的核心：
    - 笔记是数据源（场景描述、状态、规则都用 Markdown）
    - 标签是路由（game-room / game-npc / game-item 等）
    - [[wikilink]] 是游戏内的连接（出口指向另一个房间笔记）
    - 事件是触发器（笔记修改后自动重载场景）
    - HTTP API 是玩家交互面（不需要 CLI）`);

    // ============================================================
    // 六、承载量评估
    // ============================================================
    console.log(chalk.bold.yellow('\n  六、承载量评估'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`

  ┌─────────────────────────────────────────────────────────────┐
  │  已知硬性限制                                                │
  ├─────────────────────────────────────────────────────────────┤
  │                                                              │
  │  限制                        值           所在位置             │
  │  ────────────────────────   ───────      ────────────────────  │
  │  SQLite 并发写入数量        1            无 WAL 模式           │
  │  API 默认返回条数           50           serve.cjs             │
  │  搜索返回条数               20           queryEngine.cjs       │
  │  CLI 列表默认条数           20           cli.cjs               │
  │  CLI 搜索默认条数           10           cli.cjs               │
  │  提交历史默认条数           20           repository.cjs        │
  │  Fuse.js 搜索上限           20           search.cjs（旧搜索）   │
  │  索引最近笔记数             20           default.cjs           │
  │  HTTP session TTL           60 分钟      serve.cjs             │
  │  SSH 认证 nonce TTL         5 分钟       serve.cjs             │
  │  SCP 传输超时               300 秒       syncRemote.cjs        │
  │  SSH 连接超时               10 秒        syncRemote.cjs        │
  │                                                              │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  性能瓶颈分析                                                │
  ├─────────────────────────────────────────────────────────────┤
  │                                                              │
  │  瓶颈 1：SQLite 并发（最严重）                                │
  │    - 默认 rollback journal，读写互斥                         │
  │    - 无 busy_timeout，并发立即失败                           │
  │    - 修复：PRAGMA journal_mode=WAL;                          │
  │                                                              │
  │  瓶颈 2：glob.sync 阻塞事件循环                               │
  │    - sync() 每次调用都同步扫描全部文件                       │
  │    - >5000 文件时 scan 耗时 3-10 秒                           │
  │    - 修复：增量扫描 + glob 结果缓存                          │
  │                                                              │
  │  瓶颈 3：LIKE 搜索全表扫描                                    │
  │    - lo find 使用 metadata LIKE '%keyword%'                  │
  │    - 无 FTS 索引，O(n) 线性                                  │
  │    - 修复：启用 SQLite FTS5                                 │
  │                                                              │
  │  瓶颈 4：wikilink 解析加载全表                                │
  │    - _resolveWikiLinkTarget() 调用 getAll()                  │
  │    - >1000 笔记时每次解析都全量加载                          │
  │    - 修复：构建内存索引（Map<title → rid>）+ 增量更新        │
  │                                                              │
  │  瓶颈 5：无资源缓存                                          │
  │    - 每次 API 请求都查 SQLite + 读文件                       │
  │    - 高频事件场景（如游戏状态轮询）开销大                    │
  │    - 修复：模块侧自行缓存，或核心提供 LRU 缓存               │
  │                                                              │
  │  瓶颈 6：sync() 每文件 stat                                  │
  │    - N 次 fs.stat 检查 mtime 是否晚于 lastSyncTime           │
  │    - 修复：使用 chokidar 事件替代 stat 轮询                   │
  │                                                              │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  规模建议                                                    │
  ├─────────────────────────────────────────────────────────────┤
  │                                                              │
  │  仓库大小          表现                                       │
  │  ───────────────   ────────────────────────────────────────   │
  │  < 1000 资源       完全流畅。所有操作即时响应。                 │
  │                    适合：个人笔记 + 文字游戏同时运行。         │
  │                                                              │
  │  1000 - 5000       良好。sync 可感知（1-3 秒），列表/搜索     │
  │                    仍然即时。                                  │
  │                    适合：中等笔记库 + 游戏 + 自动化模块。      │
  │                                                              │
  │  5000 - 10000      sync 明显变慢（5-15 秒），搜索开始吃力。   │
  │                    建议开启 WAL 模式。                         │
  │                    适合：大型笔记库，但游戏需自行缓存数据。    │
  │                                                              │
  │  10000+            sync 成为痛点，LIKE 搜索不可用。            │
  │                    必须做 WAL + FTS + 增量扫描。              │
  │                    不适合：需评估是否拆分多仓库。              │
  │                                                              │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  文字游戏场景的具体评估                                       │
  ├─────────────────────────────────────────────────────────────┤
  │                                                              │
  │  场景：100 个游戏房间，每个房间 1 篇笔记                      │
  │  数据量：100 篇 note 类型的笔记                              │
  │  评估：完全在 < 1000 舒适区内，无任何性能问题                   │
  │                                                              │
  │  场景：玩家操作 → 读房间 → 计算 → 写状态                      │
  │  评估：读多写少。SQLite 无 WAL 下读写不互斥（SELECT 期间      │
  │        INSERT 会排队但不会失败）。游戏每秒 10 次请求完全 OK。  │
  │                                                              │
  │  场景：1000 个玩家同时通过 HTTP API 操作游戏                  │
  │  评估：serve.cjs 写锁排队会成为瓶颈。建议玩家操作合并为        │
  │        批量提交，减少锁竞争。开启 WAL 后可改善。              │
  │                                                              │
  │  场景：游戏内容用 Markdown 编写，笔记驱动所有玩法              │
  │  评估：核心优势——笔记即数据，编辑即创作，sync 即分发。        │
  │        模块不需要自己维护数据库，不需要实现同步协议。          │
  │                                                              │
  └─────────────────────────────────────────────────────────────┘`);

    // ============================================================
    // 七、双代码路径问题
    // ============================================================
    console.log(chalk.bold.yellow('\n  七、已知架构问题'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  双代码路径（legacy docs/ vs 当前 resources/）：

    早期版本：数据存储在 docs/ 目录，由 Scanner/Indexer/SearchEngine 管理
    当前版本：数据存储在 resources/ 目录，由 ResourceService 管理

    遗留模块 Still in the codebase：
      - src/core/note.cjs — Note 类写入 docs/（与 Repository 路径不互通）
      - src/services/scanner.cjs — 扫描 docs/
      - src/services/indexer.cjs — 索引 docs/
      - src/services/search.cjs — Fuse.js 搜索（docs/ 路径）

    这些模块虽然被 index.cjs 导出，但已与 Repository 体系脱节。
    模块开发应只使用 Repository 体系（resources/），不要碰 docs/ 路径。

  metadata 不跨类型：

    _extractMetadata() 仅对 note 类型提取 title 和 wordCount。
    图片/PDF/视频等无自动提取的元数据，完全依赖手动设置或
    HTTP API 上传时提供的 mimetype 和 size。

  search 无专用索引：

    lo find 使用 SQL LIKE（queryEngine.cjs），旧搜索使用 Fuse.js
    （search.cjs），两套系统都不读同一个数据源。
    FTS 索引是未来的明确需求。

  sync 协议非 CRDT：

    同步采用"操作日志复制"模型，冲突时 last-write-wins +
    本地备份（.conflict.loec）。不是无冲突复制数据类型（CRDT），
    因此多设备同时编辑同一文件会产生冲突文件，需要手动处理。`);

    // ============================================================
    // 八、优化路线图
    // ============================================================
    console.log(chalk.bold.yellow('\n  八、优化路线图（按优先级）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`

  第一优先级：基础设施（支撑模块系统 + 改善并发）
  ────────────────────────────────────────────────────

    1. 开启 WAL 模式
       位置：database.cjs initTables()
       改动：db.run("PRAGMA journal_mode=WAL;")
       效果：读写不再互斥，并发写入性能提升 3-5 倍
       风险：极低，SQLite WAL 模式已十多年生产验证

    2. 事件总线
       新增：src/repo/eventBus.cjs
       改动：Repository 挂载 EventEmitter 实例
       效果：模块可订阅资源变更，不再需要轮询
       风险：低，仅在写入路径增加 emit 调用

    3. 模块加载器
       新增：src/modules/loader.cjs
       改动：Repository.open() 末尾加载模块
       效果：模块可插拔，独立开发，独立失败
       风险：低，模块目录不存在 = 跳过加载

  第二优先级：性能优化
  ────────────────────────────────────────────────────

    4. 搜索优化
       方案 A：启用 SQLite FTS5 全文索引
       方案 B：增加内存搜索索引（Map<title → rid>）
       推荐：先 B 后 A

    5. sync 增量优化
       方案 A：缓存 glob 结果，仅在 chokidar 事件时增量更新
       方案 B：用 chokidar 事件替代 fs.stat 轮询
       推荐：B 可以独立实现

    6. 资源缓存层
       方案 A：LRU 缓存最近访问的 resource 对象
       方案 B：内存 Map<rid, { metadata, contentHash }> 快速索引
       推荐：B 最简单有效

  第三优先级：生态扩展
  ────────────────────────────────────────────────────

    7. metadata 自定义字段支持
       改动：validateMetadata.cjs 允许模块注册的字段通过校验
       效果：模块可存储模块专有元数据而不污染公共字段

    8. WebSocket / SSE 推送
       效果：客户端可实时接收资源变更事件，替代轮询

    9. 模块市场 / 仓库
       效果：社区可共享和发现模块`);

    // ============================================================
    // 九、模块开发最佳实践
    // ============================================================
    console.log(chalk.bold.yellow('\n  九、模块开发最佳实践'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  1. 利用标签做资源分类识别
     用一组约定的标签（如 game-room / game-npc / game-item）
     来识别哪些笔记属于你的模块，而不是要求用户使用特定目录或命名规则。

  2. 用 Markdown 结构做数据 schema
     笔记内容用标题层级（# ## ###）划分字段，
     用列表（-）表示数组，用 [[wikilink]] 表示关联。
     不需要 JSON schema，Markdown 本身就是结构化格式。

  3. 缓存计算结果
     模块应在 onLoad 时计算好自己的索引/状态，
     事件更新时增量修改，不要每次请求都重新解析所有笔记。

  4. 独立的模块状态存储
     如果模块需要存储运行时状态（如游戏玩家进度），
     可以写入 .repo/modules/<module-id>/ 目录下的文件。
     这个目录不会被 sync 同步（除非显式配置），
     适合本地状态而非需要多设备共享的数据。

  5. 失败隔离
     onLoad 中 try-catch 包裹所有初始化逻辑。
     事件处理函数中 try-catch 防止一个异常阻止后续事件。
     模块应该假设 repo 可能随时关闭（onUnload 被调用）。

  6. 版本兼容
     依赖 lo 核心 API 时，检查 repo API 是否存在：
       if (typeof repo.resources.list === 'function') { ... }
     而非假设 API 永远不变。`);

    console.log(chalk.gray('\n  相关文档：'));
    console.log(chalk.gray('    lo docs plugin         — 插件系统详解'));
    console.log(chalk.gray('    lo docs event          — 事件总线详解'));
    console.log(chalk.gray('    lo docs workflow       — 工作流引擎详解'));
    console.log(chalk.gray('    lo docs permission     — 权限系统详解'));
    console.log(chalk.gray('    lo docs agent          — 知识智能体详解'));
    console.log(chalk.gray('    lo docs collaboration  — 多智能体协作'));
    console.log(chalk.gray('    lo docs ai-os          — AI 原生知识 OS'));
    console.log(chalk.gray('    lo docs evolution      — 知识系统自演化'));
    console.log(chalk.gray('    lo docs knowledge      — 知识智能分析'));
    console.log(chalk.gray('    lo docs federation     — 联邦知识图谱'));
    console.log(chalk.gray('    lo docs notes          — 笔记详解'));
    console.log(chalk.gray('    lo docs database       — 数据库结构'));
    console.log(chalk.gray('    lo docs sync           — 远程同步'));
    console.log(chalk.gray('    lo docs serve          — HTTP API'));
    console.log('');
};
