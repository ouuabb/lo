/**
 * StepExecutor — 统一步骤执行器
 *
 * Phase 6.3: 根据步骤类型分发到具体处理器。
 *
 * 步骤类型 → 处理:
 *   analysis     → KnowledgeAnalyzer
 *   ai           → KnowledgeAssistant
 *   plugin       → PluginManager
 *   operation    → OperationEngine
 *   condition    → ConditionEngine（由 WorkflowExecutor 处理）
 *   notification → 日志输出
 *   parallel     → 批量执行（暂简化为顺序）
 */

class StepExecutor {
  /**
   * @param {object} services
   * @param {object} [services.repository]
   * @param {object} [services.pluginManager]
   * @param {object} [services.conditionEngine]
   * @param {object} [services.logger]
   */
  constructor(services = {}) {
    this.repository = services.repository || null;
    this.pluginManager = services.pluginManager || null;
    this.conditionEngine = services.conditionEngine || null;
    this.logger = services.logger || console;
  }

  /**
   * 执行步骤
   * @param {import('./workflowStep.cjs')} step
   * @param {import('./workflowContext.cjs')} context
   * @returns {Promise<any>} 步骤结果
   */
  async execute(step, context) {
    switch (step.type) {
      case 'analysis':
        return this._executeAnalysis(step, context);
      case 'ai':
        return this._executeAI(step, context);
      case 'plugin':
        return this._executePlugin(step, context);
      case 'operation':
        return this._executeOperation(step, context);
      case 'notification':
        return this._executeNotification(step, context);
      case 'parallel':
        return this._executeParallel(step, context);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Analysis 步骤：调用 KnowledgeAnalyzer
   */
  async _executeAnalysis(step, context) {
    // 收集分析数据并存入 context
    const result = { type: 'analysis', stepId: step.id, timestamp: Date.now() };

    if (this.repository) {
      try {
        // 尝试获取分析结果
        const analyzer = await (async () => {
          try { return await this.repository._getKnowledgeAnalyzer(); }
          catch { return null; }
        })();

        if (analyzer) {
          const report = await analyzer.report();
          result.data = report;
          context.set(`analysis_${step.id}`, report);
        }
      } catch (e) {
        result.error = e.message;
      }
    }

    return result;
  }

  /**
   * AI 步骤：调用 KnowledgeAssistant
   */
  async _executeAI(step, context) {
    const result = { type: 'ai', stepId: step.id, timestamp: Date.now() };

    if (this.repository) {
      try {
        const query = step.config.query || step.config.prompt || '';
        const answer = await this.repository.askKnowledge(query);
        result.response = answer;
        context.set(`ai_${step.id}`, answer);

        // 生成建议
        if (step.config.generateSuggestions) {
          const suggestions = await this.repository.generateSuggestions();
          result.suggestions = suggestions;
          context.set(`suggestions_${step.id}`, suggestions);
        }
      } catch (e) {
        result.error = e.message;
      }
    }

    return result;
  }

  /**
   * Plugin 步骤：调用插件
   */
  async _executePlugin(step, context) {
    const pluginId = step.config.pluginId;
    if (!pluginId) throw new Error('Plugin step requires config.pluginId');

    const result = { type: 'plugin', stepId: step.id, pluginId };

    if (this.pluginManager) {
      const plugin = this.pluginManager.getPlugin(pluginId);
      if (plugin) {
        result.pluginName = plugin.name;
        result.pluginState = plugin.state;
      } else {
        result.error = `Plugin '${pluginId}' not found`;
      }
    }

    return result;
  }

  /**
   * Operation 步骤：通过 OperationEngine 执行操作
   */
  async _executeOperation(step, context) {
    const result = { type: 'operation', stepId: step.id, timestamp: Date.now() };

    if (this.repository) {
      try {
        const action = step.config.action;

        if (action === 'create_snapshot') {
          const snap = await this.repository.createKnowledgeSnapshot();
          result.snapshot = snap;
        } else if (action === 'run_automation') {
          // 运行自动化
          const autoResult = {};
          try {
            const lifecycle = await this.repository.getKnowledgeLifecycle();
            autoResult.lifecycle = lifecycle;
            const repair = await this.repository.runKnowledgeRepair();
            autoResult.repair = repair;
          } catch (e) { this.logger.error('stepExecutor: run automation failed', e); }
          result.automation = autoResult;
        }
      } catch (e) {
        result.error = e.message;
      }
    }

    return result;
  }

  /**
   * Notification 步骤：日志通知
   */
  async _executeNotification(step, context) {
    const message = step.config.message || `Workflow step '${step.id}' completed`;
    this.logger.log(`[workflow] Notification: ${message}`);

    return {
      type: 'notification',
      stepId: step.id,
      message,
      timestamp: Date.now()
    };
  }

  /**
   * Parallel 步骤：并发执行子步骤（简化：顺序执行）
   */
  async _executeParallel(step, context) {
    const subSteps = step.config.steps || [];
    const results = [];

    // 简化：按顺序执行
    for (const subDef of subSteps) {
      const subStep = new (require('./workflowStep.cjs'))(subDef);
      const subResult = await this.execute(subStep, context);
      results.push(subResult);
    }

    return {
      type: 'parallel',
      stepId: step.id,
      results,
      timestamp: Date.now()
    };
  }
}

module.exports = StepExecutor;
