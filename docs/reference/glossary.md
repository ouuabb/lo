## 术语表

本文档定义 lo 中的核心术语。

### 基础概念

**RID（Resource Identifier）**
资源标识符。格式为 `res_` 前缀 + 24 位十六进制随机字符串，如 `res_a1b2c3d4e5f6`。每个资源在入库时被分配一个 RID，一旦分配永不变更。RID 是资源的一等公民标识，所有操作（编辑、删除、链接、标签）均以 RID 为首要引用方式。

**GlobalRID**
联邦知识图谱中的全局资源标识符。用于跨仓库引用资源，格式包含仓库标识和本地 RID，支持不同 lo 仓库之间的知识图谱互联。

**Name**
资源的逻辑名称，人类可读的标签。从文件路径自动推导，如文件名去掉日期前缀和随机后缀。`name + layer` 组合唯一。

**Resource**
仓库中的一等公民实体。拥有唯一 RID，可以是笔记、图片、PDF、视频或任何类型的文件。所有资源在 lo 中地位平等。

**Resource Type**
资源类型，如 note、image、pdf、video、code 等。类型决定资源在某些操作中的行为，但不改变资源平等的核心原则。

**Layer（资源层）**
资源栈中的层级编号。layer 0 为活跃层（默认操作该层），layer 1~19 为栈层（冗余备份）。通过 `name + layer` 组合唯一标识。

**Stack（资源栈）**
处理同名资源冲突的自动冗余机制。同名资源依次进入不同 layer，最多 20 层。活跃层始终可用，栈层为保留备份。

**Metadata**
资源的 JSON 格式元数据，存储在 SQLite 的 metadata 列。包含 title、wordCount、tags、category、status 等字段。写入时严格校验类型和字段名。

---

### 容器与成员

**Container（容器）**
具有 `container` capability 的 Resource。可以管理成员、按 schema 过滤类型、扫描内容源目录。类似"项目"或"相册"的概念。

**Container Capability**
Resource 的一种能力标记（`capabilities: ["container"]`），赋予资源管理成员的能力。

**Container Schema**
容器的成员规则配置（`container_schema`），定义了允许的成员类型（`allowed_types`）。

**Member**
容器中的条目。可以是 File Member（未提升，无独立 RID）或 Resource Member（已提升，有独立 RID）。

**File Member**
`container_members` 表中 `resource_rid = NULL` 的条目。只是一个文件索引，没有独立身份，不能参与 Relation。

**Resource Member**
已被 `lo container promote` 提升为独立 Resource 的成员。拥有 RID，可以参与 Relation、添加标签和分类。

**Promote（提升）**
将 File Member 提升为 Resource Member 的操作。提升后文件获得独立 RID，但仍保留在容器中。

**Demote（降级）**
将 Resource Member 降级为 File Member 的操作（`--revert`）。降级后成员失去独立 Resource 关联，但 Resource 本身不受影响。

**Content Source**
Resource 的内容来源。通过 `resource_sources` 表绑定，支持 local_folder、git_repository、zip_archive 等类型。与 Resource 身份解耦。

---

### 加密与认证

**RepoKey**
仓库主密钥。随机生成的 AES-256 密钥（32 字节），直接用于加密/解密所有资源文件。存储在 `.repo/keys/repo.key`（明文）或不存在（已被 SSH 保护）。

**KEK（Key Encryption Key）**
密钥加密密钥。从 SSH 私钥通过 HKDF-SHA256 派生，用于加密保护 RepoKey。仅存在于内存中，不存储到磁盘。

**HKDF（HMAC-based Key Derivation Function）**
基于 HMAC 的密钥派生函数（RFC 5869）。lo 使用 HKDF-SHA256 从 SSH 私钥派生出 KEK，包含 Salt 和 Info 上下文绑定。

**LOEC（Log End-to-End Encrypted）**
lo 的加密文件格式。二进制格式，包含魔数（LOEC）、版本号、随机 IV、AES-256-GCM 密文和 GCM 认证标签。

**SSH Challenge-Response**
基于 SSH 签名的挑战-应答认证协议。客户端用私钥签名服务端提供的随机 nonce，服务端用公钥验证。私钥不离开客户端。

**Session Token**
HTTP API 的会话令牌。通过 SSH 挑战-应答认证获取，有效期 60 分钟，超时后需重新登录。

**protected_*.key**
受 SSH 保护的 RepoKey 文件。包含用 KEK 加密后的 RepoKey。文件可随仓库同步，但没有对应 SSH 私钥的人无法解密。

---

### 版本控制

**Staging Area（暂存区）**
Git 风格的版本控制中间层。存储在 `.repo/staging.json`，包含 added、modified、deleted、renamed、metadata 五个列表。`lo commit` 后清空。

**Commit（提交）**
将暂存区的变更写入数据库并记录提交历史。commit 会更新 resources 表的 hash/metadata，写入 commits 表，生成 sync_ops 操作日志。

**Soft Delete（软删除）**
标记资源 `deleted = 1` 而非物理删除。数据保留在数据库中，查询时被过滤。relations 表不清除，保留历史链接关系。

**Hard Delete（硬删除）**
物理删除资源（`--hard`），从 resources 和 relations 表移除记录。不可恢复。

---

### 同步与分布式

**Operation Log（操作日志）**
同步的基本单位。记录在 sync_ops 表中，包含五种操作类型。多个设备通过重放操作日志来同步状态。

**Batch（批次）**
一次 push 产生的自包含 tar.gz 文件。包含 manifest.json、ops.json、checksums.json 和资源文件。每个批次可独立验证完整性。

**Sync Anchor（同步锚点）**
记录"已同步到哪个位置"的标记。存储在 sync_config 表中，按（设备, 远程）独立维护。

**Push**
将本地产生的操作日志打包成 batch，通过 SCP 传输到远程。

**Pull**
从远程下载最新 batch，解包校验后应用到本地。

**Clone**
从远程完整克隆仓库（类似 git clone）。下载所有历史 batch，按时间顺序重放所有操作日志。

**Remote（远程）**
lo 的中继目标。可以是 SSH 服务器、本地路径或 U 盘。只是存储 batch 文件的裸目录，不需要运行任何 lo 进程。

---

### AI 与扩展

**OODA（Observe-Orient-Decide-Act）**
知识系统自演化的核心循环。Observe（观察）→ Analyze（分析）→ Detect（检测）→ Plan（规划）→ Execute（执行）→ Validate（验证）。

**Agent（智能体）**
lo 中的 AI 智能体，具有特定角色（researcher、curator、analyst、monitor、assistant），通过状态机、记忆系统和规划/执行/反思循环自主运行。

**Federation（联邦知识图谱）**
跨仓库的知识图谱互联机制。通过 GlobalRID 在不同 lo 仓库之间建立引用关系，实现知识的联邦式管理和发现。

**Plugin（插件）**
lo 的可扩展模块。通过 PluginManager 管理加载/初始化/激活/停用/卸载生命周期，支持 hook、route、command、transformer、validator 等扩展点。

**Event Bus（事件总线）**
lo 内部的发布-订阅系统。支持 resource/sync/lifecycle 事件，模块通过订阅事件来响应仓库变化。

**Workflow（工作流）**
lo 的自动化工作流引擎。通过步骤模型（action/condition/loop/parallel/wait/script）和调度器定义和执行自动化流程。

---

### 链接系统

**Wikilink**
在 Markdown 笔记中使用 `[[...]]` 语法建立的自动双向链接。支持 RID 匹配（`[[res_xxx]]`）、标题匹配（`[[笔记标题]]`）和别名语法（`[[目标|别名]]`）。

**Relation**
资源间的关系记录，存储在 relations 表中（`type: 'wikilink'` 或 `'reference'`）。基于 RID 建立，文件重命名不影响链接。

**双向链接**
lo 自动维护的反向链接机制。当 A → B 的 wikilink 创建时，同时自动创建 B → A 的反向链接。

---

### 相关文档

- [核心概念](../guide/concepts.md) — 设计哲学入门
- [RID 一等公民](../core/rid.md) — RID 的完整说明
- [加密系统](../core/encryption.md) — RepoKey、KEK、HKDF 详解
- [远程同步](../core/sync.md) — 同步机制
- [系统架构](../advanced/architecture.md) — Phase 6 扩展系统
