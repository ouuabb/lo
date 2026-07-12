const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  知识系统自演化（Phase 6.8）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.bold.yellow('\n  一、概述'));
    console.log(`
  知识系统自演化引擎使 lo 能够观察自身状态、分析问题、
  检测改进机会，并自动执行优化，实现系统的自我进化。

  OODA 循环（Observe → Analyze → Detect → Plan → Execute
  → Validate → Remember）是演化的核心框架。

  核心组件：
    - EvolutionEngine       — 演化引擎（顶层控制器）
    - SelfImprovementLoop   — OODA 自我改进循环
    - SystemObserver        — 系统观察器
    - KnowledgeHealthAnalyzer — 健康度分析器
    - EvolutionDetector     — 进化机会检测器
    - EvolutionStrategy     — 策略生成器
    - EvolutionPlanner      — 进化规划器
    - EvolutionExecutor     — 进化执行器
    - EvolutionValidator    — 进化验证器
    - EvolutionMemory       — 进化记忆
    - EvolutionState        — 进化状态`);

    console.log(chalk.bold.yellow('\n  二、OODA 循环'));
    console.log(`
  完整的自我改进循环流程：

    1. Observe  → 系统观察器采集知识库快照
                  - 资源数量与类型分布
                  - 知识图谱连通性
                  - 系统复杂度指标

    2. Analyze  → 健康度分析器诊断系统问题
                  - 连通性检查（低连接度告警）
                  - 复杂度评估
                  - 健康度评分

    3. Detect   → 进化检测器发现改进机会
                  - 孤立资源聚类
                  - 断裂关系修复
                  - 知识空缺填补

    4. Plan     → 策略生成器 + 规划器制定方案
                  - 生成改进策略
                  - 制定执行计划
                  - 优先级排序

    5. Execute  → 执行器安全执行改进操作
                  - 建议关系建立
                  - 资源分类优化
                  - 标签标准化

    6. Validate → 验证器对比前后状态
                  - 健康度变化
                  - 改进效果量化
                  - 副作用检测

    7. Remember → 记忆系统记录本次进化
                  - 存入 evolution_history 表
                  - 更新进化状态快照
                  - 积累成功/失败经验`);

    console.log(chalk.bold.yellow('\n  三、健康度分析'));
    console.log(`
  健康度分析器评估知识库的以下维度：

  维度        说明                告警阈值
  ──────────  ─────────────────  ──────────
  连通性      知识间的连接密度    < 0.3（非空库）
  复杂度      资源类型多样性      过高/过低
  完整性      元数据覆盖率        < 80%
  活跃度      最近更新频率        < 每月1次
  冗余度      重复/相似资源比例   > 20%

  空库处理：
    资源数为 0 时不触发低连接度告警（避免误报）。`);

    console.log(chalk.bold.yellow('\n  四、进化检测'));
    console.log(`
  进化检测器识别以下改进机会：

  检测类型        说明
  ──────────────  ──────────────────────────────────
  orphan_resources  未被任何关系引用的孤立资源
  broken_relations  指向已删除资源的断裂关系
  tag_gaps         缺少标签的资源
  cluster_opportunity 可聚类的相关资源组
  bridge_opportunity  可建立桥接的概念节点`);

    console.log(chalk.bold.yellow('\n  五、数据库结构'));
    console.log(`
  自演化系统在数据库中新增三张表：

  evolution_states — 进化状态快照
    ├── id              快照 ID
    ├── version         版本号
    ├── health          健康度
    ├── complexity      复杂度
    ├── connectivity    连通性
    ├── maturity        成熟度
    ├── snapshot        完整快照（JSON）
    └── score           综合评分

  evolution_actions — 进化执行记录
    ├── type            操作类型
    ├── strategy        策略名称
    ├── action          具体操作
    ├── status          执行状态
    └── result          执行结果

  evolution_history — 进化历史
    ├── before_state    进化前状态
    ├── after_state     进化后状态
    ├── action          执行的改进
    ├── improvement     改进幅度
    └── result          验证结果`);

    console.log(chalk.bold.yellow('\n  六、CLI 命令'));
    console.log(`
    lo evolution status    查看当前进化状态
    lo evolution analyze   分析系统并诊断问题
    lo evolution run       执行一次自我改进循环
    lo evolution history   查看进化历史记录`);

    console.log(chalk.gray('\n  相关命令：'));
    console.log(chalk.gray('    lo evolution status/analyze/run/history'));
    console.log(chalk.gray('    lo ai               — AI 原生知识 OS'));
    console.log(chalk.gray('    lo knowledge        — 知识智能分析'));
    console.log(chalk.gray('    lo manual evolution'));
    console.log('');
};
