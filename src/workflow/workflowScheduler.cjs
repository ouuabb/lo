/**
 * WorkflowScheduler — 工作流调度器
 *
 * Phase 6.3: 支持定时触发工作流。
 *
 * 触发方式:
 *   - schedule: { cron: 'daily' | 'weekly' | 'monthly', time: '02:00' }
 *   - event: { event: 'resource.created' }  ← 由 EventBus 处理
 *   - manual: 手动触发
 */

class WorkflowScheduler {
  /**
   * @param {object} services
   * @param {object} services.eventBus
   * @param {object} services.workflowEngine
   * @param {object} [services.logger]
   */
  constructor(services = {}) {
    this.eventBus = services.eventBus;
    this.workflowEngine = services.workflowEngine;
    this.logger = services.logger || console;
    this._timers = new Map();
  }

  /**
   * 启动调度器
   */
  start() {
    // 通过 EventBus 监听事件触发类型的工作流
    if (this.eventBus && this.workflowEngine) {
      this.eventBus.on('*', async (payload, event) => {
        try {
          await this.workflowEngine.triggerByEvent(event.type, payload);
        } catch (e) {
          // Silently ignore
        }
      });
    }
  }

  /**
   * 停止调度器
   */
  stop() {
    for (const timer of this._timers.values()) {
      clearInterval(timer);
    }
    this._timers.clear();
  }

  /**
   * 调度定时工作流
   * @param {import('./workflow.cjs')} workflow
   */
  schedule(workflow) {
    if (!workflow.trigger || workflow.trigger.type !== 'schedule') return;

    const { cron, time } = workflow.trigger.schedule || workflow.trigger;
    if (!cron) return;

    const interval = this._getInterval(cron, time);

    if (interval > 0) {
      const timer = setInterval(async () => {
        try {
          this.logger.log(`[scheduler] Triggering: ${workflow.id}`);
          await this.workflowEngine.execute(workflow.id);
        } catch (e) {
          this.logger.error(`[scheduler] Workflow '${workflow.id}' failed: ${e.message}`);
        }
      }, interval);

      this._timers.set(workflow.id, timer);
    }
  }

  /**
   * 取消定时
   */
  unschedule(workflowId) {
    const timer = this._timers.get(workflowId);
    if (timer) {
      clearInterval(timer);
      this._timers.delete(workflowId);
    }
  }

  /**
   * 计算间隔（毫秒）
   */
  _getInterval(cron, time) {
    const now = new Date();

    switch (cron) {
      case 'daily': {
        const [h, m] = (time || '00:00').split(':').map(Number);
        const target = new Date(now);
        target.setHours(h || 0, m || 0, 0, 0);
        if (target <= now) target.setDate(target.getDate() + 1);
        return target.getTime() - now.getTime();
      }
      case 'weekly': {
        const [h, m] = (time || '00:00').split(':').map(Number);
        const target = new Date(now);
        target.setHours(h || 0, m || 0, 0, 0);
        // Next Monday
        const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
        target.setDate(target.getDate() + daysUntilMonday);
        return target.getTime() - now.getTime();
      }
      case 'monthly': {
        const [h, m] = (time || '00:00').split(':').map(Number);
        const target = new Date(now.getFullYear(), now.getMonth() + 1, 1, h || 0, m || 0, 0, 0);
        return target.getTime() - now.getTime();
      }
      default:
        return 0;
    }
  }
}

module.exports = WorkflowScheduler;
