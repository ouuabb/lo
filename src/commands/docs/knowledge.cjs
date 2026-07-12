const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  知识智能分析（Phase 5.7~5.11）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.bold.yellow('\n  一、概述'));
    console.log(`
  知识智能分析套件提供对知识图谱的深度分析和优化能力，
  覆盖从基础知识分析到 AI 辅助决策的完整链路。

  Phase 阶段   功能
  ───────────  ──────────────────────────────────
  Phase 5.7    知识分析、缺口检测、智能推荐
  Phase 5.8    AI 辅助知识图谱、建议管理
  Phase 5.9    知识自动化管线
  Phase 5.10   联邦知识图谱、跨仓库同步
  Phase 5.11   知识演化分析、模式检测、构建策略`);

    console.log(chalk.bold.yellow('\n  二、知识分析（Phase 5.7）'));
    console.log(`
  知识分析提供对知识图谱的多维度评估：

    lo knowledge analyze      完整分析报告
    lo knowledge gaps          知识缺口检测
    lo knowledge recommend     智能推荐（关联知识 + 学习路径）
    lo knowledge timeline      知识演化时间线
    lo knowledge lifecycle     资源生命周期状态
    lo knowledge repair        知识修复诊断

  分析维度：
    - 密度分析：知识在各领域的分布密度
    - 孤岛检测：未被引用或未引用他人的资源
    - 缺口检测：应该存在但缺失的知识连接
    - 生命周期：资源的创建/活跃/沉淀/归档状态`);

    console.log(chalk.bold.yellow('\n  三、AI 辅助（Phase 5.8）'));
    console.log(`
  AI 辅助知识图谱通过语义分析生成智能建议：

    lo knowledge ai explain <rid>    AI 解释资源位置
    lo knowledge ai summarize <rid>  AI 生成摘要
    lo knowledge ai ask <query>      AI 知识问答

    lo suggestion list              查看 AI 建议
    lo suggestion approve <id>      批准建议
    lo suggestion execute <id>      执行（创建关系）
    lo suggestion reject <id>       拒绝建议

  AI 建议类型：
    - 关联建议：推荐建立资源间关系
    - 分类建议：推荐资源归类
    - 标签建议：推荐添加标签`);

    console.log(chalk.bold.yellow('\n  四、知识自动化（Phase 5.9）'));
    console.log(`
  自动化管线一站式执行知识库维护：

    lo automation run

  管线步骤：
    1. 生命周期检查 → 标记过期/孤立资源
    2. 修复诊断     → 断裂关系、孤立资源、重复资源
    3. AI 建议生成  → 新的关联、标签、分类建议`);

    console.log(chalk.bold.yellow('\n  五、联邦知识图谱（Phase 5.10）'));
    console.log(`
  联邦系统支持跨仓库的知识图谱操作：

    lo federation list                    列出联邦仓库
    lo federation add <path> --namespace  注册仓库
    lo federation remove <namespace>      移除仓库

    lo graph query-federated <globalId>   联邦图查询

  GlobalRID:
    全局资源标识符格式: namespace:rid
    示例: personal:res_abc123

    使不同仓库的资源可以在联邦图中唯一标识。`);

    console.log(chalk.bold.yellow('\n  六、演化与模式（Phase 5.11）'));
    console.log(`
  知识演化分析和模式检测：

    lo knowledge evolution    演化分析（增长/速度/熵/趋势）
    lo knowledge patterns     模式检测
    lo knowledge strategy     构建策略推荐
    lo knowledge snapshot     创建状态快照

  检测的知识模式：
    - Hub:      被大量资源引用的中心节点
    - Chain:    线性连接的资源链
    - Bridge:   连接两个知识域的桥接节点
    - Dead-end: 没有出向链接的终端节点`);

    console.log(chalk.gray('\n  相关命令：'));
    console.log(chalk.gray('    lo knowledge analyze/gaps/recommend/...'));
    console.log(chalk.gray('    lo suggestion list/approve/execute/reject'));
    console.log(chalk.gray('    lo automation run'));
    console.log(chalk.gray('    lo federation list/add/remove'));
    console.log(chalk.gray('    lo evolution    — 知识系统自演化'));
    console.log(chalk.gray('    lo manual knowledge'));
    console.log('');
};
