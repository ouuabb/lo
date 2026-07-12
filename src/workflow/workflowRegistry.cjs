/**
 * WorkflowRegistry — 工作流注册表
 *
 * Phase 6.3: 管理 Workflow 定义。
 */

const WorkflowStore = require('./workflowStore.cjs');
const Workflow = require('./workflow.cjs');

class WorkflowRegistry {
  /**
   * @param {import('../repo/database.cjs')} db
   */
  constructor(db) {
    this.store = new WorkflowStore(db);
    /** @type {Map<string, Workflow>} */
    this._workflows = new Map();
  }

  /**
   * 注册工作流
   */
  async register(workflow) {
    if (this._workflows.has(workflow.id)) {
      throw new Error(`Workflow '${workflow.id}' is already registered`);
    }

    // 验证
    const errors = workflow.validate();
    if (errors.length > 0) {
      throw new Error(`Workflow validation failed: ${errors.join('; ')}`);
    }

    this._workflows.set(workflow.id, workflow);
    await this.store.saveDefinition(workflow);
  }

  /**
   * 注销
   */
  async remove(id) {
    this._workflows.delete(id);
    await this.store.deleteDefinition(id);
  }

  /**
   * 获取
   */
  get(id) {
    return this._workflows.get(id) || null;
  }

  /**
   * 列出
   */
  list() {
    return Array.from(this._workflows.values()).map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      status: w.status,
      stepCount: w.steps.length
    }));
  }

  /**
   * 从存储加载
   */
  async load() {
    const defs = await this.store.listDefinitions();
    for (const def of defs) {
      const full = await this.store.getDefinition(def.id);
      if (full) {
        const wf = Workflow.fromJSON(full);
        this._workflows.set(wf.id, wf);
      }
    }
    return this._workflows.size;
  }
}

module.exports = WorkflowRegistry;
