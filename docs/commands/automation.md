## automation — 知识自动化

**用法:** `lo automation run`

运行完整自动化管线，一站式执行知识库维护任务。

### 自动化管线

自动化管线按顺序执行以下步骤:

1. **生命周期检查** — 扫描所有资源，按活跃度分类（active / inactive / forgotten / archived）
2. **修复诊断** — 检测断裂关系、孤立资源和重复候选
3. **AI 建议生成** — 基于分析结果自动生成链接建议

### 示例

```
lo automation run               # 运行完整自动化管线
```

### 输出说明

运行后会显示:
- **Lifecycle**: 各生命周期状态的资源数量
- **Repair**: 断裂关系数、孤立资源数、重复候选数
- **Suggestions**: 生成的建议数量和优先级分布（high / medium / low），按分类统计

如果知识库健康则显示 "No issues found. Knowledge base is healthy."

### 工作机制

自动化管线整合了 `lo knowledge lifecycle`、`lo knowledge repair` 和 AI 建议引擎:
- 生命周期检查基于资源的最后访问/修改时间
- 修复诊断扫描 relations 表中指向不存在的资源的关系（断裂）、没有任何关系的资源（孤立）、标题相似度高的资源对（重复候选）
- 生成的建议可通过 `lo suggestion list` 查看和管理

### 注意事项

- AI 建议生成需要 AI 后端支持
- 建议使用 `lo suggestion list` 查看生成的建议
- 自动化管线为只读分析，不会自动修改数据库

### 相关命令

- [knowledge](knowledge.md) — 知识智能分析套件
- [suggestion](suggestion.md) — AI 建议管理
- [workflow](workflow.md) — 工作流引擎
- lo docs knowledge
