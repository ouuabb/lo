## 数据库与资源索引

lo 使用 SQLite 作为本地数据库。

### 表结构总览

| 表名 | 用途 |
|------|------|
| resources | 资源元数据（RID、路径、哈希、类型、加密状态、标签、分类等）|
| relations | 资源间的双向链接关系（wikilink / reference）|
| commits | 提交历史记录 |
| sync_ops | 操作日志，同步的基本单位 |
| sync_config | 配置键值对（设备 ID、同步锚点、远程别名）|
| sync_log | 同步活动审计日志 |

### resources 表结构

```sql
CREATE TABLE resources (
    rid          TEXT PRIMARY KEY,     -- 资源唯一标识 (res_xxx)
    type         TEXT,                 -- 资源类型 (note, image, pdf, ...)
    path         TEXT,                 -- resources/ 下的相对路径
    hash         TEXT,                 -- 明文 SHA-256（变更检测）
    metadata     TEXT,                 -- JSON 元数据（标题、字数、标签、分类、状态等）
    encrypted    INTEGER,              -- 是否加密 (0/1)
    created      INTEGER,              -- 创建时间戳 (ms)
    updated      INTEGER,             -- 最后修改时间戳 (ms)
    deleted      INTEGER              -- 是否软删除 (0/1)
);
```

### resources 表核心字段说明

- **rid**：唯一标识符（`res_xxx` 格式），RID 是主键，不可变更
- **type**：资源类型（note, image, pdf, video, audio, html, text, json, document, spreadsheet, presentation, archive, drawing, code, unknown）
- **path**：文件系统路径（`resources/` 下的相对路径）
- **hash**：明文 SHA-256 散列，用于变更检测和去重检测
- **metadata**：JSON 格式元数据，包含 title、wordCount、tags、category、status 等字段
- **encrypted**：加密状态（0=明文, 1=已加密）
- **deleted**：软删除标记（0=正常, 1=已删除）

### 散列的用途

- **变更检测**：比较文件当前散列与 DB 记录，判断内容是否变化
- **去重检测**：通过散列判断文件是否已导入
- **重命名检测**：自动匹配 hash 识别文件重命名/移动

DB 中存储**明文散列**，不暴露文件内容本身。加密文件先解密再散列，相同内容多次加密产生相同散列，正确检测不变更。

### relations 表结构

```sql
CREATE TABLE relations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    from_rid    TEXT NOT NULL,          -- 源资源 RID
    to_rid      TEXT NOT NULL,          -- 目标资源 RID
    type        TEXT NOT NULL,          -- 'wikilink' 或 'reference'
    name        TEXT,                   -- 链接显示名
    created     TEXT NOT NULL,          -- 创建时间
    updated     TEXT NOT NULL,          -- 更新时间
    UNIQUE(from_rid, to_rid, type)
);
```

### commits 表结构

- `id`：自增主键
- `message`：提交信息
- `timestamp`：时间戳
- `added / updated / deleted / renamed / metadata`：变更统计

### 索引

- `resources(type)` — 按类型过滤
- `resources(path)` — 按路径查找
- `sync_ops(timestamp)` — 按时间查询操作日志
- `sync_ops(device_id)` — 按设备过滤操作
- `relations(from_rid, to_rid, type)` — 唯一约束

### 注意事项

- 未开启 WAL 模式（默认 rollback journal）
- 无 full-text search（FTS）索引
- 无 `resources(hash)` 索引
- metadata 是 JSON 字符串列，不可在 SQL 中按子字段过滤

### 加密感知

- 加密文件先解密再散列
- DB 始终存储明文 SHA-256
- 相同内容多次加密 → 相同散列 → 正确检测不变更

### 相关文档

- [RID 一等公民](rid.md) — resources 表主键设计
- [操作追踪体系](../advanced/operations.md) — sync_ops 表详解
- [搜索系统](search.md) — 搜索与查询引擎
- [版本控制](version.md) — commits 表与暂存区
