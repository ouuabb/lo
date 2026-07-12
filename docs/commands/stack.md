## stack — 管理资源栈

**用法:** `lo stack <list|pop|drop> [name] [layer]`

管理同名资源冲突时自动保存的冗余副本（栈层）。

### 核心概念

每个资源名称最多可有 20 层（layer 0~19）。layer 0 为活跃层（日常操作默认使用的版本），layer 1~19 为栈层（自动冗余备份）。

**自动入栈**: 任意入口（`lo new`、拖文件、`lo sync`）遇到同名资源时，新文件会自动分配到下一个空闲栈层，无需手动干预。

**栈隔离**: 日常操作（show/edit/delete/tag/link）默认只操作活跃层，栈中资源不影响正常使用。通过 rid 可直接操作任意层。

### 子命令

| 子命令 | 说明 |
|--------|------|
| `list` | 列出所有栈中资源，按 name 分组显示 |
| `pop <name>` | 弹出栈顶，提升为活跃层（原活跃层入栈） |
| `drop <name> <layer>` | 丢弃指定栈层（硬删除） |

### 示例

```
lo stack list                        # 查看所有栈中资源
lo stack pop 笔记测试                  # 将栈顶提升为活跃
lo stack drop 笔记测试 1               # 丢弃 layer 1
```

### 注意事项

- 栈最多 20 层（layer 0~19），超过会回退到 `.conflict` 文件方式
- pull 冲突产生的远程版本会自动入栈，conflict_source 标记为 "remote"
- 合并冲突后走正常的 add → commit 流程

### 相关命令

- [sync](sync.md) — 同步时自动触发入栈
- [pull](pull.md) — 拉取冲突时远程版本入栈
- lo new — 创建同名资源时自动入栈
