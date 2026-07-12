## docs-serve — 启动 VitePress 文档站

**用法:** `lo docs serve [--port <端口>]`

启动基于 VitePress 的本地文档站点，在浏览器中浏览 lo 的完整文档。文档站包含快速上手指南、核心概念、高级主题和命令参考。

### 选项

- `--port, -p <端口>` — 监听端口（默认: 5173）

### 示例

```
lo docs serve                    # 默认端口启动
lo docs serve --port 3000        # 自定义端口
```

### 工作机制

- 使用 VitePress 构建和热加载文档站点
- 文档源文件位于 `docs/` 目录，使用 Markdown 格式
- 启动后自动打开浏览器访问本地文档站
- 支持热更新：修改文档源文件后浏览器自动刷新

### 注意事项

- 需要预先安装 VitePress 依赖（`npm install`）
- 与 `lo serve` 不同，`lo docs serve` 服务于文档浏览而非 API 调用
- 文档站默认监听 `localhost`，不对外暴露
- 按 `Ctrl+C` 停止服务

### 相关命令

- lo serve — 启动 HTTP API 服务
- lo docs — 在终端查看文档主题
- [manual](manual.md) — 命令参考手册
