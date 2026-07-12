## 快速上手指南

### 1. 创建新仓库

```bash
lo init
```

在当前目录初始化一个 lo 仓库。这会创建 `.repo/` 目录，包含 SQLite 数据库、密钥文件和暂存区。

### 2. 生成 SSH 密钥（如果没有）

```bash
ssh-keygen -t ed25519 -C "lo-notebook"
```

> lo 推荐使用 Ed25519 密钥。如果已有 SSH 密钥，可以跳过此步。

### 3. 绑定 SSH 密钥保护加密密钥

```bash
lo auth add -k ~/.ssh/id_ed25519 -l "我的电脑"
```

这会将仓库的加密主密钥（RepoKey）用你的 SSH 私钥保护起来，防止硬盘被盗后密钥泄露。绑定后，明文的 `repo.key` 被删除，替换为 `protected_xxx.key`。

### 4. 创建笔记

```bash
lo new "我的第一篇加密笔记"
```

这会在 `resources/` 目录下创建一个 Markdown 文件，文件名格式为 `YYYY-MM-DD-标题slug.md`。如果仓库已加密，笔记内容会自动加密为 LOEC 格式。

### 5. 暂存和提交

```bash
lo add .
lo commit -m "初始导入"
```

lo 使用类似 Git 的版本控制工作流。`lo add` 将文件变更加入暂存区，`lo commit` 将暂存的变更写入数据库并记录提交历史。

### 6. 日常操作

```bash
lo list          # 查看所有笔记
lo find "关键词"  # 搜索笔记
lo edit res_xxx  # 编辑笔记
lo show res_xxx  # 查看笔记内容
lo status        # 查看变更状态
```

### 7. 备份

```bash
lo backup --dest ~/backups
```

备份会打包 `resources/` 目录和 `.repo/` 中的数据库及配置，但会排除 `.repo/keys/` 目录以防止密钥泄露。

### 8. 远程同步

```bash
# 添加远程仓库别名
lo remote add my-server user@host:~/notes

# 推送到远程
lo push my-server

# 从远程拉取
lo pull my-server
```

远程只是一个通过 SSH 访问的裸目录，不需要运行任何 lo 进程。资源文件以 LOEC 加密格式传输，服务器只能看到密文。

### 9. 在不同设备上使用

```bash
# 在第一台设备上启动 HTTP 服务（可选）
lo serve

# 在另一台设备上克隆仓库
lo clone user@host:~/notes ~/my-notes
```

> `lo clone` 需要远程服务器上有完整的历史批次文件（sync_batches/），它会从零开始重建数据库状态。

### 更多帮助

```bash
lo manual <命令名>    # 查看特定命令的详细手册
lo help               # 查看简洁命令列表
lo docs               # 查看所有文档索引
```

### 相关文档

- [核心概念](concepts.md) — 理解 lo 的设计哲学
- [日常工作流](workflow.md) — 完整的日常使用流程
- [加密系统](../core/encryption.md) — 端到端加密详解
- [远程同步](../core/sync.md) — 多设备同步指南
