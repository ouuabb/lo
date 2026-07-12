## workflow — 工作流引擎

**用法:** `lo workflow <list|run|status|history> [选项...]`

管理工作流定义和运行实例。工作流引擎提供步骤模型、条件引擎和调度器，支持定义和执行复杂的自动化流程。

### 子命令

- `list` — 列出所有工作流定义
- `run <id>` — 执行指定工作流
- `status <id>` — 查询执行状态（步骤结果、上下文数据）
- `history [id]` — 查询执行历史（可选择过滤特定工作流）

### 选项

**run:**
- `--input <JSON>` — 输入 JSON 数据

**history:**
- `--limit <数量>` — 数量限制（默认: 20）

### 示例

```
lo workflow list                           # 列出工作流
lo workflow run auto-tag                   # 执行工作流
lo workflow run analyze --input '{"rid":"res_abc"}'  # 带输入
lo workflow status exec_123                # 查看执行状态
lo workflow history                        # 执行历史
```

### 工作机制

- **步骤模型**: 工作流定义为有序步骤序列，每个步骤有独立的输入/输出和条件判断
- **条件引擎**: 基于步骤输出决定执行路径，支持分支和条件跳转
- **调度器**: 管理执行队列，控制并发和超时
- **执行跟踪**: 每次执行生成唯一 execution ID，记录每步结果和状态

### 注意事项

- 工作流执行前需要工作流系统初始化（`initWorkflowSystem`）
- 执行失败的工作流可通过 status 查看具体失败步骤
- 工作流定义通过仓库插件或内置注册

### 相关命令

- [automation](automation.md) — 知识自动化管线
- lo docs workflow
