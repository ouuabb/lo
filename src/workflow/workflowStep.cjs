/**
 * WorkflowStep — 工作流步骤模型
 *
 * Phase 6.3: 表示 Workflow 中的单个执行节点。
 *
 * 步骤类型:
 *   analysis     — 知识分析（调用 KnowledgeAnalyzer）
 *   operation    — 操作执行（通过 OperationEngine）
 *   condition    — 条件判断（通过 ConditionEngine）
 *   plugin       — 插件调用
 *   ai           — AI 建议
 *   notification — 通知
 *   parallel     — 并行执行
 */

class WorkflowStep {
  /**
   * @param {object} opts
   * @param {string} opts.id
   * @param {string} opts.type
   * @param {object} [opts.config]
   * @param {string} [opts.next] — 下一步 ID（默认按顺序）
   * @param {string} [opts.onError] — 错误处理: skip | stop | retry
   */
  constructor({ id, type, config, next, onError } = {}) {
    if (!id) throw new Error('Step must have an id');
    if (!type) throw new Error('Step must have a type');

    this.id = id;
    this.type = type;
    this.config = config || {};
    this.next = next || null;
    this.onError = onError || 'stop';
  }

  /**
   * 验证步骤类型
   */
  get validTypes() {
    return ['analysis', 'operation', 'condition', 'plugin', 'ai', 'notification', 'parallel'];
  }

  validate() {
    if (!this.validTypes.includes(this.type)) {
      throw new Error(`Invalid step type: ${this.type}. Valid: ${this.validTypes.join(', ')}`);
    }
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      config: this.config,
      next: this.next,
      onError: this.onError
    };
  }

  static fromJSON(json) {
    return new WorkflowStep(json);
  }
}

module.exports = WorkflowStep;
