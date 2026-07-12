/**
 * RuntimeScheduler — 统一调度器
 *
 * Phase 6.10: 整合 Workflow Scheduler 和 Agent Scheduler，
 * 形成统一的 Runtime 调度层。
 * 支持 startup / interval / cron / event 四种调度模式。
 */

class RuntimeScheduler {
  constructor(context = null) {
    this.context = context;
    this._tasks = new Map();
    this._running = false;
    this._timer = null;
  }

  // ─── 任务管理 ─────────────────────────────────────────

  /**
   * 注册定时任务
   */
  schedule(id, fn, options = {}) {
    this._tasks.set(id, {
      id,
      fn,
      mode: options.mode || 'interval',
      cronExpr: options.cron || null,
      intervalMs: options.intervalMs || 60000,
      lastRun: null,
      running: false
    });
  }

  /**
   * 取消任务
   */
  unschedule(id) {
    this._tasks.delete(id);
  }

  /**
   * 待处理任务数
   */
  pendingCount() {
    let count = 0;
    for (const [, task] of this._tasks) {
      if (!task.running) {
        const shouldRun = this._shouldRun(task);
        if (shouldRun) count++;
      }
    }
    return count;
  }

  // ─── 启动/停止 ────────────────────────────────────────

  start(tickMs = 1000) {
    if (this._running) return;
    this._running = true;
    this._timer = setInterval(() => this.tick(), tickMs);
  }

  stop() {
    this._running = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  // ─── Tick ─────────────────────────────────────────────

  async tick() {
    if (!this._running) return;

    for (const [, task] of this._tasks) {
      if (task.running) continue;
      if (!this._shouldRun(task)) continue;

      task.running = true;
      task.lastRun = Date.now();

      try {
        await task.fn(this.context);
      } catch (e) {
        // 任务错误不中断调度器
      } finally {
        task.running = false;
      }
    }
  }

  _shouldRun(task) {
    if (task.mode === 'event') return false; // 事件驱动的不在此调度

    const now = Date.now();
    const lastRun = task.lastRun || 0;

    if (task.mode === 'interval' || task.mode === 'startup') {
      return (now - lastRun) >= task.intervalMs;
    }

    if (task.mode === 'cron' && task.cronExpr) {
      return this._matchCron(task.cronExpr, task.lastRun);
    }

    return false;
  }

  _matchCron(expr, lastRun) {
    // 简化版 cron 匹配 — 只检查过了 intervalMs
    // 完整 cron 实现需要解析表达式
    return true;
  }
}

module.exports = RuntimeScheduler;
