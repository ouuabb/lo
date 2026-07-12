/**
 * WorkflowExecutor — 工作流执行器
 *
 * Phase 6.3: 按步骤顺序执行 Workflow。
 *
 * 流程:
 *   load workflow
 *     ↓
 *   create context
 *     ↓
 *   for each step:
 *     check condition
 *     execute step
 *     save state
 *   next step
 */

const WorkflowContext = require('./workflowContext.cjs');

class WorkflowExecutor {
  /**
   * @param {object} services
   * @param {import('./stepExecutor.cjs')} services.stepExecutor
   * @param {import('./conditionEngine.cjs')} services.conditionEngine
   * @param {import('./workflowStore.cjs')} [services.store]
   * @param {object} [services.eventBus]
   * @param {object} [services.logger]
   */
  constructor(services = {}) {
    this.stepExecutor = services.stepExecutor;
    this.conditionEngine = services.conditionEngine;
    this.store = services.store || null;
    this.eventBus = services.eventBus || null;
    this.logger = services.logger || console;
  }

  /**
   * 执行工作流
   * @param {import('./workflow.cjs')} workflow
   * @param {any} [input] — 初始输入
   * @param {string} [executionId] — 执行 ID（恢复时传入）
   * @returns {Promise<WorkflowContext>}
   */
  async execute(workflow, input = {}, executionId) {
    const execId = executionId || `wfexec_${Date.now().toString(36)}`;

    // 创建上下文
    const context = new WorkflowContext({
      workflowId: workflow.id,
      executionId: execId,
      input
    });

    // 开始执行
    context.status = 'running';

    // 保存初始状态
    if (this.store) {
      await this.store.saveExecution(context);
    }

    // 发布事件
    if (this.eventBus) {
      try {
        this.eventBus.emit({
          type: 'workflow.started',
          payload: { workflowId: workflow.id, executionId: execId }
        });
      } catch {}
    }

    try {
      let currentStep = workflow.firstStep;

      while (currentStep) {
        context.currentStep = currentStep.id;

        // 检查条件
        if (currentStep.config.condition) {
          const shouldExecute = this.conditionEngine.evaluate(
            { workflowContext: context, step: currentStep },
            currentStep.config.condition
          );

          if (!shouldExecute) {
            context.setResult(currentStep.id, { skipped: true, reason: 'condition_not_met' });
            currentStep = workflow.getNextStep(currentStep.id);
            continue;
          }
        }

        // 执行步骤
        try {
          const result = await this.stepExecutor.execute(currentStep, context);
          context.setResult(currentStep.id, { success: true, ...result });
        } catch (e) {
          this.logger.error(`[wfexec] Step '${currentStep.id}' failed: ${e.message}`);

          context.setResult(currentStep.id, { success: false, error: e.message });

          if (currentStep.onError === 'stop') {
            throw e; // 向上抛出
          } else if (currentStep.onError === 'retry') {
            // 重试一次
            try {
              const retryResult = await this.stepExecutor.execute(currentStep, context);
              context.setResult(currentStep.id, { success: true, retried: true, ...retryResult });
            } catch (retryErr) {
              context.setResult(currentStep.id, { success: false, error: retryErr.message });
              if (currentStep.onError === 'retry') throw retryErr;
            }
          }
          // skip: 继续下一步
        }

        // 保存状态
        if (this.store) {
          await this.store.saveExecution(context);
        }

        // 下一步
        currentStep = workflow.getNextStep(currentStep.id);
      }

      context.status = 'completed';
    } catch (e) {
      context.status = 'failed';
      context.variables._error = e.message;

      // 发布失败事件
      if (this.eventBus) {
        try {
          this.eventBus.emit({
            type: 'workflow.finished',
            payload: { workflowId: workflow.id, executionId: execId, status: 'failed' }
          });
        } catch {}
      }
    }

    // 完成
    if (context.status === 'completed') {
      if (this.eventBus) {
        try {
          this.eventBus.emit({
            type: 'workflow.finished',
            payload: { workflowId: workflow.id, executionId: execId, status: 'completed' }
          });
        } catch {}
      }
    }

    if (this.store) {
      await this.store.saveExecution(context);
    }

    return context;
  }
}

module.exports = WorkflowExecutor;
