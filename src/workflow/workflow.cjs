/**
 * Workflow — 工作流定义
 *
 * Phase 6.3: 定义可复用的自动化流程。
 *
 * 结构:
 *   id          — 唯一标识
 *   name        — 名称
 *   description — 描述
 *   trigger     — 触发方式 { type: 'event' | 'schedule' | 'manual', ... }
 *   steps       — WorkflowStep[]
 *   status      — active | inactive
 */

const WorkflowStep = require('./workflowStep.cjs');

class Workflow {
  /**
   * @param {object} opts
   * @param {string} opts.id
   * @param {string} [opts.name]
   * @param {string} [opts.description]
   * @param {object} [opts.trigger] — { type, event?, schedule? }
   * @param {Array} [opts.steps]
   */
  constructor({ id, name, description, trigger, steps } = {}) {
    if (!id) throw new Error('Workflow must have an id');

    this.id = id;
    this.name = name || id;
    this.description = description || '';
    this.trigger = trigger || { type: 'manual' };
    this.status = 'active';
    this.createdAt = Date.now();

    // 解析步骤
    this.steps = (steps || []).map(s => {
      if (s instanceof WorkflowStep) return s;
      return new WorkflowStep(s);
    });

    // 构建步骤索引
    this._stepIndex = new Map();
    for (const step of this.steps) {
      this._stepIndex.set(step.id, step);
    }
  }

  /**
   * 获取步骤
   */
  getStep(id) {
    return this._stepIndex.get(id);
  }

  /**
   * 获取第一个步骤
   */
  get firstStep() {
    return this.steps[0] || null;
  }

  /**
   * 获取下一步
   */
  getNextStep(stepId) {
    const step = this._stepIndex.get(stepId);
    if (!step) return null;

    // 如果有显式 next
    if (step.next) {
      return this._stepIndex.get(step.next) || null;
    }

    // 否则按数组顺序
    const idx = this.steps.findIndex(s => s.id === stepId);
    if (idx < 0 || idx >= this.steps.length - 1) return null;
    return this.steps[idx + 1];
  }

  /**
   * 验证工作流定义
   */
  validate() {
    const errors = [];

    if (this.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    for (const step of this.steps) {
      try {
        step.validate();
      } catch (e) {
        errors.push(`Step '${step.id}': ${e.message}`);
      }
    }

    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      trigger: this.trigger,
      steps: this.steps.map(s => s.toJSON()),
      status: this.status,
      createdAt: this.createdAt
    };
  }

  static fromJSON(json) {
    const wf = new Workflow({
      id: json.id,
      name: json.name,
      description: json.description,
      trigger: json.trigger,
      steps: json.steps
    });
    wf.status = json.status || 'active';
    wf.createdAt = json.createdAt || Date.now();
    return wf;
  }
}

module.exports = Workflow;
