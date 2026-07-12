## plugin — 插件系统管理

**用法:** `lo plugin <list|enable|disable|reload|info> [id]`

管理 lo 插件系统的插件加载、启用和禁用。插件系统提供可扩展的模块化能力，支持插件生命周期管理、扩展点注册和上下文隔离。

### 子命令

- `list` — 列出已加载的插件
- `enable <id>` — 启用指定插件
- `disable <id>` — 禁用指定插件
- `reload <id>` — 重载指定插件
- `info <id>` — 查看插件详细信息（版本、状态、依赖、扩展点注册、Hook 注册数）

### 示例

```
lo plugin list                         # 查看所有插件
lo plugin enable text-game             # 启用文字游戏插件
lo plugin disable text-game            # 禁用插件
lo plugin reload text-game             # 重载插件
lo plugin info text-game               # 查看插件详情
```

### 工作机制

- **插件生命周期**: 插件注册后经过加载 → 初始化 → 启用/禁用状态转换
- **扩展点注册**: 插件通过 manifest 声明 contributes（贡献点），在加载时注册到扩展注册表
- **Hook 管理**: 插件可注册事件 Hook，在特定时机自动触发
- **上下文隔离**: 插件运行在独立上下文中，互不干扰
- **依赖管理**: 插件可声明依赖关系（manifest.dependencies）

### 注意事项

- 插件存储在仓库中，与仓库数据绑定
- 禁用插件不会卸载，仅停止其功能
- 重载插件会重新读取配置并重新注册扩展点和 Hook

### 相关命令

- [event](event.md) — 事件总线
- lo docs plugin
