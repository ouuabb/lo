## 工作流引擎（Phase 6.3）

### 一、概述

lo 工作流引擎提供步骤模型和条件驱动的执行引擎，允许用户定义和执行复杂的自动化流程。工作流可以手动触发、定时调度或由事件驱动。

**核心组件：**

| 组件 | 说明 |
|------|------|
| WorkflowEngine | 工作流执行引擎，核心编排器 |
| WorkflowRegistry | 工作流注册表 |
| StepModel / WorkflowStep | 步骤定义模型 |
| StepExecutor | 步骤执行器 |
| ConditionEngine | 条件评估引擎 |
| WorkflowScheduler | 定时调度器 |
| WorkflowStore | 执行历史存储 |

### 二、步骤模型

每个工作流由一系列步骤组成，每个步骤有明确的输入/输出：

| 步骤类型 | 说明 |
|----------|------|
| action | 执行具体操作（创建/更新/删除资源） |
| condition | 条件分支（if/else/switch） |
| loop | 循环（遍历资源列表） |
| parallel | 并行执行多个子步骤 |
| wait | 等待指定时间或外部事件 |
| script | 执行自定义脚本 |

**步骤定义示例：**

```json
{
  "id": "analyze",
  "type": "action",
  "action": "knowledge.analyze",
  "input": { "scope": "all" },
  "onSuccess": "report-pass",
  "onError": "report-fail"
}
```

> **重要提示**：步骤间通过 `onSuccess`/`onError` 指定跳转逻辑，支持灵活的分支和错误处理。

### 三、条件引擎

条件引擎在工作流执行期间评估条件表达式：

**支持的条件类型：**
- 资源属性比较（hash、type、size、tags）
- 时间条件（before、after、between）
- 逻辑组合（and、or、not）
- 自定义函数（通过插件扩展）

条件评估在 `condition` 类型步骤中执行，根据结果为工作流选择不同的执行分支。

### 四、调度器

调度器支持多种触发方式：

| 触发方式 | 说明 | 示例 |
|----------|------|------|
| manual | 手动执行 | `lo workflow run <id>` |
| scheduled | 定时执行 | cron 表达式，如 `0 2 * * *` |
| event-driven | 事件触发 | 如 `resource:created` 触发自动标签 |
| chain | 工作流链式调用 | 一个工作流完成后触发另一个 |

> **重要提示**：事件驱动的工作流通过 `WorkflowEngine.triggerByEvent()` 实现，当指定事件发生时自动匹配并执行相应工作流。

### 五、执行管理

**执行状态：**

```
pending → running → completed
                  → failed
                  → paused → resumed
                  → cancelled
```

**执行管理 API：**

- `execute(workflowId, input)` — 启动执行
- `pause(executionId)` — 暂停执行
- `resume(executionId)` — 恢复执行（从上次断点继续）
- `cancel(executionId)` — 取消执行
- `status(executionId)` — 查询执行状态
- `getHistory(workflowId, limit)` — 查询执行历史

执行历史持久化到 `workflow_executions` 表中，支持完整的审计追溯。

**CLI 命令：**

```bash
lo workflow list     # 列出可用工作流
lo workflow run      # 运行工作流
lo workflow status   # 查看执行状态
lo workflow history  # 查看执行历史
```

---

**相关文档：**

- [事件总线](event.md) — 工作流事件触发的基础
- [知识自动化](knowledge/automation.md) — 自动化管线基于工作流引擎
- [知识智能体](agent.md) — Agent 通过工作流引擎编排任务
