## add — 添加文件到暂存区

**用法:** `lo add <路径> [路径...]       lo add .`

将文件添加到暂存区，是提交前的必要步骤。

**暂存行为:**
- 指定文件路径：添加单个或多个文件
- 使用 `.` ：添加仓库目录下所有变更（新增、修改、删除），排除 .repo/node_modules/.git
- 新文件（数据库中不存在）→ 加入 added 列表
- 已存在文件（数据库中已有记录）→ 加入 modified 列表

### 示例

```bash
lo add "resources/笔记.md"              # 添加单个文件
lo add "resources/a.md" "resources/b.md" # 添加多个文件
lo add .                                 # 添加所有文件
```

### 相关命令

- [commit](./commit.md) — 提交暂存区
- [reset](./reset.md) — 取消暂存
- [status](./status.md) — 查看工作区状态
- [diff](./diff.md) — 显示文件变更差异
