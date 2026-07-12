/**
 * ConceptMemory — 概念记忆
 *
 * Phase 6.7: 知识概念层。
 *
 * 存储: Concept
 *   + meaning
 *   + relations
 *   + history
 *   + confidence
 */

class ConceptMemory {
  constructor() {
    /** @type {Map<string, object>} */
    this._concepts = new Map();
  }

  /**
   * 保存或更新概念
   */
  save(concept) {
    const existing = this._concepts.get(concept.name);
    if (existing) {
      existing.meaning = concept.meaning || existing.meaning;
      existing.confidence = Math.max(existing.confidence, concept.confidence || 0);
      existing.relations = concept.relations || existing.relations;
      existing.history = [...(existing.history || []), { action: 'updated', at: Date.now() }];
    } else {
      this._concepts.set(concept.name, {
        name: concept.name,
        meaning: concept.meaning || '',
        relations: concept.relations || [],
        confidence: concept.confidence || 0.5,
        history: [{ action: 'created', at: Date.now() }],
        createdAt: Date.now()
      });
    }
  }

  /**
   * 搜索概念
   */
  async search(query, limit = 5) {
    const q = query.toLowerCase();
    const results = [];

    for (const [name, concept] of this._concepts) {
      if (name.toLowerCase().includes(q) || (concept.meaning || '').toLowerCase().includes(q)) {
        results.push(concept);
      }
    }

    // 按 confidence 排序
    results.sort((a, b) => b.confidence - a.confidence);
    return results.slice(0, limit);
  }

  get(name) {
    return this._concepts.get(name) || null;
  }

  count() {
    return this._concepts.size;
  }

  list(limit = 50) {
    return Array.from(this._concepts.values()).slice(0, limit);
  }

  stats() {
    const values = Array.from(this._concepts.values());
    const avgConfidence = values.length > 0
      ? values.reduce((s, c) => s + c.confidence, 0) / values.length
      : 0;
    return { conceptCount: values.length, avgConfidence: Math.round(avgConfidence * 100) / 100 };
  }
}

module.exports = ConceptMemory;
