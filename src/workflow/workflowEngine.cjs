/**
 * WorkflowEngine — 工作流引擎
 *
 * Phase 6.3: 核心编排引擎。
 *
 * API:
 *   register(workflow)   — 注册工作流
 *   execute(id, input)   — 执行
 *   pause(executionId)   — 暂停（标记）
 *   resume(executionId)  — 恢复
 *   cancel(executionId)  — 取消（标记）
 *   status(executionId)  — 查询状态
 *   triggerByEvent(type, payload) — 事件触发
 */

const WorkflowStore = require('./workflowStore.cjs');
const WorkflowExecutor = require('./workflowExecutor.cjs');

class WorkflowEngine {
  /**
   * @param {object} services
   * @param {import('../repo/database.cjs')} services.db
   * @param {import('./workflowRegistry.cjs')} services.registry
   * @param {import('./stepExecutor.cjs')} services.stepExecutor
   * @param {import('./conditionEngine.cjs')} services.conditionEngine
   * @param {object} [services.eventBus]
   * @param {object} [services.logger]
   */
  constructor(services = {}) {
    this.db = services.db;
    this.registry = services.registry;
    this.stepExecutor = services.stepExecutor;
    this.conditionEngine = services.conditionEngine;
    this.eventBus = services.eventBus || null;
    this.logger = services.logger || console;

    this.store = new WorkflowStore(this.db);

    /** @type {Map<string, Promise>} 正在执行的工作流 */
    this._running = new Map();
  }

  /**
   * 注册工作流
   */
  async register(workflow) {
    return this.registry.register(workflow);
  }

  /**
   * 执行工作流
   * @param {string} workflowId
   * @param {any} [input]
   * @returns {Promise<import('./workflowContext.cjs')>}
   */
  async execute(workflowId, input = {}) {
    const workflow = this.registry.get(workflowId);
    if (!workflow) throw new Error(`Workflow '${workflowId}' not found`);

    const executor = new WorkflowExecutor({
      stepExecutor: this.stepExecutor,
      conditionEngine: this.conditionEngine,
      store: this.store,
      eventBus: this.eventBus,
      logger: this.logger
    });

    const promise = executor.execute(workflow, input);
    this._running.set(workflowId, promise);

    try {
      const result = await promise;
      this._running.delete(workflowId);
      return result;
    } catch (e) {
      this._running.delete(workflowId);
      throw e;
    }
  }

  /**
   * 通过事件触发工作流
   */
  async triggerByEvent(eventType, payload) {
    const all = this.registry.list();

    for (const wfInfo of all) {
      const wf = this.registry.get(wfInfo.id);
      if (!wf) continue;

      if (wf.trigger && wf.trigger.type === 'event' && wf.trigger.event === eventType) {
        try {
          await this.execute(wf.id, payload);
        } catch (e) {
          this.logger.error(`[wfengine] Triggered workflow '${wf.id}' failed: ${e.message}`);
        }
      }
    }
  }

  /**
   * 暂停执行（标记状态）
   */
  async pause(executionId) {
    const exec = await this.store.getExecution(executionId);
    if (!exec) throw new Error(`Execution '${executionId}' not found`);

    const ctx = exec.context;
    ctx.status = 'paused';
    await this.store.saveExecution({ ...ctx, executionId: exec.id, workflowId: exec.workflowId });
  }

  /**
   * 恢复执行
   */
  async resume(executionId) {
    const exec = await this.store.getExecution(executionId);
    if (!exec) throw new Error(`Execution '${executionId}' not found`);

    const workflow = this.registry.get(exec.workflowId);
    if (!workflow) throw new Error(`Workflow '${exec.workflowId}' not found`);

    // 从上次停下的步骤继续
    const ctx = exec.context;
    const executor = new WorkflowExecutor({
      stepExecutor: this.stepExecutor,
      conditionEngine: this.conditionEngine,
      store: this.store,
      eventBus: this.eventBus,
      logger: this.logger
    });

    // 跳过已完成的步骤
    const startAfter = ctx.currentStep;
    // 简化：重新执行整个 workflow，但跳过已完成的步骤

    return executor.execute(workflow, ctx.input, executionId);
  }

  /**
   * 取消执行
   */
  async cancel(executionId) {
    const exec = await this.store.getExecution(executionId);
    if (!exec) throw new Error(`Execution '${executionId}' not found`);

    const ctx = exec.context;
    ctx.status = 'cancelled';
    await this.store.saveExecution({ ...ctx, executionId: exec.id, workflowId: exec.workflowId });
  }

  /**
   * 查询执行状态
   */
  async status(executionId) {
    return this.store.getExecution(executionId);
  }

  /**
   * 列出工作流
   */
  listWorkflows() {
    return this.registry.list();
  }

  /**
   * 查询执行历史
   */
  async getHistory(workflowId, limit = 20) {
    return this.store.listExecutions(workflowId, limit);
  }

  /**
   * 获取运行中的执行
   */
  get runningCount() {
    return this._running.size;
  }
}

module.exports = WorkflowEngine;
