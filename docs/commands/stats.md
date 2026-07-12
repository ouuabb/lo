## stats — 显示统计信息

**用法:** `lo stats`

显示资源仓库的统计数据，包括资源总数、各类型数量、标签分布等。

### 示例

```
lo stats
```

### 输出内容

统计内容包括但不限于:
- 资源总数
- 各类型资源数量（note、image、pdf 等）
- 标签分布情况

### 相关命令

- [index](index.md) — 生成仓库索引文件
- lo serve — 提供 HTTP API 统计端点（GET /api/stats）
