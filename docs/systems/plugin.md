## 插件系统（Phase 6.1）

### 一、概述

lo 插件系统提供可扩展的模块化能力，允许第三方开发者为 lo 添加新功能而无需修改核心代码。插件通过标准化的生命周期管理和扩展点机制与核心系统交互。

**核心组件：**

| 组件 | 说明 |
|------|------|
| PluginManager | 插件加载、卸载、生命周期管理的中枢控制器 |
| PluginLoader | 从文件系统发现和加载插件，支持循环依赖检测和拓扑排序 |
| PluginRegistry | 插件注册表，管理已加载插件的元信息 |
| HookSystem | 钩子系统，插件可注册回调（通过 HookManager 实现） |
| ExtensionPoint | 扩展点定义，插件可实现标准接口（通过 ExtensionRegistry 管理） |
| ContextIsolation | 上下文隔离，每个插件运行在独立的 PluginContext 中 |

### 二、插件生命周期

每个插件经过以下生命周期阶段：

```
load → initialize → activate → (running) → deactivate → unload
```

1. **load**：从磁盘加载插件代码，验证 manifest（plugin.json）
2. **initialize**：调用插件的 `onInit()`，创建 PluginContext 上下文，注入依赖
3. **activate**：调用插件的 `onActivate()`，注册扩展点到 ExtensionRegistry
4. **running**：插件正常运行，响应事件和调用
5. **deactivate**：调用插件的 `onDeactivate()`，从扩展注册表中清理
6. **unload**：从内存中卸载插件代码，清理所有注册信息

状态转换由 LifecycleManager 管理：`loaded → initialized → enabled → disabled → disposed`

> **重要提示**：插件管理器在初始化阶段会对所有插件进行循环依赖检测和拓扑排序，确保依赖关系正确的插件先加载。

**CLI 管理命令：**

```bash
lo plugin list       # 列出已加载插件
lo plugin enable id  # 启用插件
lo plugin disable id # 禁用插件（保持加载但暂停）
lo plugin reload id  # 重载插件（deactivate → unload → load → activate）
lo plugin info id    # 查看插件详情
```

### 三、扩展点

插件通过实现扩展点来添加功能：

| 扩展类型 | 说明 |
|----------|------|
| hook | 生命周期钩子回调（如 onResourceCreate） |
| route | 注册 HTTP API 路由 |
| command | 注册 CLI 子命令 |
| transformer | 内容转换器（导入/导出/渲染） |
| validator | 自定义校验器 |
| storage | 自定义存储后端 |
| indexer | 自定义索引器 |

插件在其 `plugin.json`（manifest）中声明实现的扩展点类型。在 `register(context)` 方法中向 ExtensionRegistry 注册具体的扩展实现。

### 四、上下文隔离

每个插件运行在独立的 PluginContext 中，确保插件间互不影响：

- 插件 crash 不会导致核心崩溃
- 插件间不能直接访问彼此的状态
- 插件通过事件总线进行通信（而非直接调用）
- 插件只能访问通过依赖注入提供的 API（repository、logger、extensionRegistry、hookManager、eventBus）

### 五、架构细节

```
PluginManager （中枢）
  ├── PluginLoader       — 文件系统扫描、依赖检测、拓扑排序
  ├── PluginRegistry     — 元信息注册
  ├── ExtensionRegistry  — 扩展点管理
  ├── HookManager        — 钩子系统
  ├── LifecycleManager   — 状态机
  └── PluginContext      — 每个插件的隔离上下文
```

插件状态持久化到 `plugins` 表：

| 字段 | 说明 |
|------|------|
| id | 插件唯一标识 |
| name | 插件名称 |
| version | 版本号 |
| enabled | 启用状态（0/1） |
| installed_at | 安装时间戳 |
| updated_at | 更新时间戳 |

---

**相关文档：**

- [事件总线](event.md) — 插件间通信基础设施
- [权限系统](permission.md) — 插件权限控制
- [工作流引擎](workflow.md) — 插件可触发的工作流
