/**
 * WorkflowContext — 工作流执行上下文
 *
 * Phase 6.3: 在步骤间传递数据，支持中断恢复。
 *
 * 结构:
 *   workflowId  — 工作流 ID
 *   executionId — 执行 ID
 *   input       — 初始输入
 *   variables   — 步骤间的共享变量
 *   results     — 每个步骤的执行结果
 *   currentStep — 当前步骤 ID
 */

class WorkflowContext {
  /**
   * @param {object} opts
   * @param {string} opts.workflowId
   * @param {string} opts.executionId
   * @param {any} [opts.input]
   */
  constructor({ workflowId, executionId, input } = {}) {
    this.workflowId = workflowId || '';
    this.executionId = executionId || '';
    this.input = input || {};
    this.variables = {};
    this.results = {};
    this.currentStep = '';
    this.status = 'created';
  }

  /**
   * 设置变量
   */
  set(key, value) {
    this.variables[key] = value;
  }

  /**
   * 获取变量
   */
  get(key) {
    return this.variables[key];
  }

  /**
   * 记录步骤结果
   */
  setResult(stepId, result) {
    this.results[stepId] = result;
  }

  /**
   * 获取步骤结果
   */
  getResult(stepId) {
    return this.results[stepId];
  }

  /**
   * 序列化（用于持久化恢复）
   */
  toJSON() {
    return {
      workflowId: this.workflowId,
      executionId: this.executionId,
      input: this.input,
      variables: this.variables,
      results: this.results,
      currentStep: this.currentStep,
      status: this.status
    };
  }

  static fromJSON(json) {
    const ctx = new WorkflowContext({
      workflowId: json.workflowId,
      executionId: json.executionId,
      input: json.input
    });
    ctx.variables = json.variables || {};
    ctx.results = json.results || {};
    ctx.currentStep = json.currentStep || '';
    ctx.status = json.status || 'created';
    return ctx;
  }
}

module.exports = WorkflowContext;
