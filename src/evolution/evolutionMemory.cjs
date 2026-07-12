/**
 * EvolutionMemory — 进化记忆
 *
 * Phase 6.8: 记录 Knowledge OS 的演化历史。
 *
 * 类似 Git 的 commit history，但记录系统进化。
 */

class EvolutionMemory {
  constructor() {
    /** @type {Array<{ fromState: object, action: string, result: object, improvement: number, createdAt: number }>} */
    this._records = [];
  }

  /**
   * 记录一次进化
   */
  record({ fromState, action, result, improvement }) {
    const r = {
      id: `evm_${this._records.length + 1}`,
      fromState: fromState ? fromState.toJSON() : null,
      action,
      result,
      improvement: improvement || 0,
      createdAt: Date.now()
    };
    this._records.push(r);
    return r;
  }

  /**
   * 历史
   */
  history(limit = 50) {
    return this._records.slice(-limit).reverse();
  }

  /**
   * 获取最近一次
   */
  last() {
    return this._records.length > 0 ? this._records[this._records.length - 1] : null;
  }

  /**
   * 统计
   */
  stats() {
    const totalImprovements = this._records.reduce((s, r) => s + (r.improvement > 0 ? r.improvement : 0), 0);
    return {
      totalEvolutions: this._records.length,
      totalImprovement: Math.round(totalImprovements * 100) / 100,
      avgImprovement: this._records.length > 0
        ? Math.round((totalImprovements / this._records.length) * 100) / 100
        : 0
    };
  }
}

module.exports = EvolutionMemory;
