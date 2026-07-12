## 知识自动化管线（Phase 5.9）

### 一、概述

知识自动化管线（KnowledgeScheduler）是后台任务系统，管理定期知识维护。支持每日、每周、每月三种粒度的自动化任务，所有操作通过 Suggestion Pipeline 流转，不直接修改数据。

**核心原则：**

> 所有操作不直接修改数据，通过 Suggestion Pipeline 流转。Analysis → Suggestion → Human Decision → Execution

### 二、调度任务

| 频率 | 任务 | 说明 |
|------|------|------|
| 每日（daily） | scanForgottenResources | 检测遗忘资源 → 生成 Suggestion |
| 每周（weekly） | analyzeKnowledgeHealth | 密度/孤岛/增长/遗忘综合分析 |
| 每月（monthly） | generateKnowledgeReport | 生成完整报告并保存 |

### 三、每日扫描

**scanForgottenResources()：**

1. 从数据库查询所有未删除资源
2. 查询每个资源的最后关系时间
3. 计算 PageRank（通过 GraphEngine）
4. 使用 ResourceLifecycle.batch() 评估生命周期
5. 筛选 `isForgotten()` 为 true 的资源
6. 为每个遗忘资源生成 `resource.revisit` 建议

**遗忘资源判断标准（ResourceLifecycle）：**

综合考虑：
- 最后关系时间（lastRelation）距离现在的天数
- PageRank 评分
- 创建/更新时间的间隔

> **建议属性**：type=resource.revisit、confidence=0.85、priority=high、30 天后过期

### 四、每周分析

**analyzeKnowledgeHealth()：**

综合分析知识库健康状态：

1. **密度分析**（via KnowledgeAnalyzer）：density + gaps 数量
2. **孤岛检测**（via KnowledgeRepair）：孤立资源数量
3. **遗忘资源计数**：调用 scanForgottenResources
4. **事件统计**：从 knowledge_events 表按类型聚合事件数

返回：`{ density, islands, gaps, forgotten, eventCounts }`

### 五、每月报告

**generateKnowledgeReport()：**

1. 执行健康度分析
2. 执行遗忘资源扫描
3. 查询资源/关系统计
4. 组装完整月报
5. 保存到 `knowledge_events` 表（type=monthly_report）

**报告内容：**

```json
{
  "generated": "<timestamp>",
  "period": "monthly",
  "resources": 150,
  "relations": 320,
  "density": { "resources": 150, "relations": 320, "density": 2.13, "level": "connected" },
  "islands": { "count": 12 },
  "gaps": 5,
  "forgotten": 8,
  "health": { /* 完整健康报告 */ }
}
```

### 六、完整自动化管线

**KnowledgeScheduler.runAll()：**

一站式执行知识库维护，流程如下：

```
┌─────────────────────────────────────────────────────────┐
│  自动化管线执行流程                                        │
│                                                         │
│  1. 生命周期检查                                          │
│     ├── 所有资源生命周期评估                                │
│     ├── 识别遗忘资源                                       │
│     └── 生成 resource.revisit 建议                         │
│                                                         │
│  2. 修复诊断                                              │
│     ├── 断裂关系检测 → repair.remove_relation 建议          │
│     ├── 孤立资源检测 → repair.connect_suggestion 建议       │
│     ├── 重复资源检测 → repair.merge_suggestion 建议         │
│     └── 汇总修补报告                                       │
│                                                         │
│  3. 保存建议                                              │
│     └── 批量写入 SuggestionEngine (createBatch)           │
│                                                         │
│  4. 记录事件                                              │
│     └── 写入 knowledge_events (type=automation_run)       │
└─────────────────────────────────────────────────────────┘
```

### 七、修复建议详情

| 修复类型 | 置信度 | 优先级 | 触发条件 |
|----------|--------|--------|----------|
| repair.remove_relation | 0.95 | high | 断裂关系存在 |
| repair.connect_suggestion | 0.7 | medium | 孤立资源存在 |
| repair.merge_suggestion | 相似度 | low | 重复候选存在 |

### 八、CLI 命令

```bash
lo automation run    # 运行完整自动化管线
```

管线运行后：
- `lo suggestion list` 查看生成的建议
- `lo suggestion approve <id>` 批准并执行建议
- `lo knowledge analyze` 查看分析结果

### 九、knowledge_events 表

自动化管线使用 `knowledge_events` 表记录关键事件：

| 事件类型 | 说明 |
|----------|------|
| automation_run | 自动化管线执行记录 |
| monthly_report | 月报记录 |

---

**相关文档：**

- [知识分析](knowledge-analysis.md) — 分析引擎
- [AI 建议管理](suggestion.md) — 建议生命周期
- [工作流引擎](../systems/workflow.md) — 底层执行引擎
- [知识系统自演化](../systems/evolution.md) — 系统级自演化
