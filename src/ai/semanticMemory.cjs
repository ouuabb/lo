/**
 * SemanticMemory — 语义记忆
 *
 * Phase 6.7: AI 长期语义记忆。
 *
 * 存储类型:
 *   concept     — 概念
 *   experience  — 经验
 *   preference  — 偏好
 *   pattern     — 模式
 *   insight     — 洞察
 */

class SemanticMemory {
  constructor() {
    /** @type {Array} */
    this._entries = [];
    this._idCounter = 0;
  }

  /**
   * 保存
   */
  save(entry) {
    const e = {
      id: `sm_${++this._idCounter}`,
      type: entry.type || 'concept',
      concept: entry.concept || '',
      value: entry.value,
      tags: entry.tags || [],
      confidence: entry.confidence || 0.5,
      createdAt: Date.now()
    };
    this._entries.push(e);
    return e;
  }

  /**
   * 检索
   */
  retrieve(query, limit = 10) {
    if (!query) return this._entries.slice(-limit).reverse();
    const q = query.toLowerCase();
    return this._entries
      .filter(e =>
        (e.concept && e.concept.toLowerCase().includes(q)) ||
        (typeof e.value === 'string' && e.value.toLowerCase().includes(q)) ||
        (e.tags || []).some(t => t.toLowerCase().includes(q))
      )
      .reverse()
      .slice(0, limit);
  }

  /**
   * 按类型查询
   */
  getByType(type, limit = 20) {
    return this._entries.filter(e => e.type === type).reverse().slice(0, limit);
  }

  stats() {
    const byType = {};
    for (const e of this._entries) {
      byType[e.type] = (byType[e.type] || 0) + 1;
    }
    return { entryCount: this._entries.length, byType };
  }
}

module.exports = SemanticMemory;
