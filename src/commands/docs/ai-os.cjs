const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  AI 原生知识操作系统（Phase 6.7）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.bold.yellow('\n  一、概述'));
    console.log(`
  AI 原生知识操作系统（AIOS）是 lo 的 AI 核心层，将 AI 能力
  深度集成到知识管理的每个环节。不是"在知识管理上加 AI"，
  而是"AI 就是操作系统本身"。

  核心组件：
    - AIOSKernel     — AI OS 内核
    - AIModelGateway — AI 模型网关（多模型统一接口）
    - ReasoningEngine — 推理引擎
    - SemanticMemory — 语义记忆
    - ConceptMemory  — 概念记忆
    - LearningEngine — 学习引擎
    - AIAssistant    — AI 助手`);

    console.log(chalk.bold.yellow('\n  二、AI 模型网关'));
    console.log(`
  统一的多模型调用接口，屏蔽不同 AI 提供商的差异：

  支持的模型类型：
    - 对话模型（chat/completion）
    - 嵌入模型（embedding）
    - 推理模型（reasoning）

  网关功能：
    - 模型路由：根据任务类型自动选择模型
    - 降级策略：主模型不可用时自动切换备用模型
    - 速率限制：防止 API 超额调用
    - 响应缓存：相同查询复用结果`);

    console.log(chalk.bold.yellow('\n  三、推理引擎'));
    console.log(`
  推理引擎负责分析和理解知识结构：

  推理能力：
    - 语义推理：理解概念间的隐含关系
    - 类比推理：发现相似的知识模式
    - 因果推理：分析知识间的因果链
    - 演绎推理：从已知知识推导新知识

  推理模式：
    - chat:        自由对话
    - analysis:    深度分析
    - research:    研究探索
    - creation:    内容创作
    - automation:  自动执行`);

    console.log(chalk.bold.yellow('\n  四、语义记忆'));
    console.log(`
  语义记忆存储对知识库的深层理解：

  记忆内容      说明
  ────────────  ──────────────────────────────────
  概念向量      概念的语义嵌入表示
  关系强度      概念间的关联强度
  主题聚类      知识主题的自动分类
  知识密度      各领域知识丰富度评估

  与 Agent 记忆的区别：
    Agent 记忆 — 个体经验（事件、对话）
    语义记忆   — 对知识库的理解（概念、关系）
    概念记忆   — 知识本体（类型、约束）`);

    console.log(chalk.bold.yellow('\n  五、学习引擎'));
    console.log(`
  学习引擎持续从用户交互中改进系统：

  学习来源：
    - 用户操作模式（常用命令、查询习惯）
    - 知识库变化（新内容、新关系）
    - 反馈信号（用户校正、偏好）

  学习输出：
    - 个性化推荐
    - 自动化规则
    - 工作流优化`);

    console.log(chalk.bold.yellow('\n  六、AI 助手'));
    console.log(`
  AI 助手是用户的对话接口：

    lo ai ask "知识库有哪些薄弱环节？"
    lo ai ask "总结核心概念" --mode analysis
    lo ai analyze           # 自动分析知识图谱
    lo ai insights          # 查看 AI 洞察
    lo ai memory            # 查看 AI 记忆`);

    console.log(chalk.gray('\n  相关命令：'));
    console.log(chalk.gray('    lo ai status/ask/analyze/insights/memory'));
    console.log(chalk.gray('    lo agent       — 知识智能体'));
    console.log(chalk.gray('    lo evolution   — 知识系统自演化'));
    console.log(chalk.gray('    lo manual ai'));
    console.log('');
};
