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
 *
 * 唯一数据源: ai_concepts 表
 */

class ConceptMemory {
  /**
   * @param {object} db - Database 实例
   */
  constructor(db) {
    this._db = db;
  }

  /**
   * 保存或更新概念
   */
  save(concept) {
    const name = concept.name;
    if (!name) return null;

    const existing = this._db.get('SELECT * FROM ai_concepts WHERE name = ?', [name]);
    const meta = existing ? JSON.parse(existing.metadata || '{}') : {};
    const history = meta.history || [];

    if (existing) {
      const meaning = concept.meaning || existing.meaning;
      const confidence = Math.max(existing.confidence, concept.confidence || 0);
      const relations = concept.relations ? JSON.stringify(concept.relations) : existing.relations;
      history.push({ action: 'updated', at: Date.now() });

      this._db.run(
        `UPDATE ai_concepts SET meaning = ?, confidence = ?, relations = ?, metadata = ?, created_at = ? WHERE name = ?`,
        [meaning, confidence, relations, JSON.stringify({ ...meta, history }), Date.now(), name]
      );
      return { name, meaning, relations: concept.relations || JSON.parse(existing.relations || '[]'), confidence, history };
    } else {
      history.push({ action: 'created', at: Date.now() });
      const meaning = concept.meaning || '';
      const confidence = concept.confidence || 0.5;
      const relations = JSON.stringify(concept.relations || []);
      const now = Date.now();

      this._db.run(
        `INSERT INTO ai_concepts (name, meaning, confidence, relations, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, meaning, confidence, relations, JSON.stringify({ history }), now]
      );
      return { name, meaning, relations: concept.relations || [], confidence, history };
    }
  }

  /**
   * 搜索概念
   */
  async search(query, limit = 5) {
    const q = `%${query.toLowerCase()}%`;
    const rows = this._db.all(
      `SELECT * FROM ai_concepts WHERE LOWER(name) LIKE ? OR LOWER(meaning) LIKE ? ORDER BY confidence DESC LIMIT ?`,
      [q, q, limit]
    );
    return rows.map(r => this._hydrate(r));
  }

  get(name) {
    const row = this._db.get('SELECT * FROM ai_concepts WHERE name = ?', [name]);
    return row ? this._hydrate(row) : null;
  }

  count() {
    const row = this._db.get('SELECT COUNT(*) as c FROM ai_concepts');
    return row.c;
  }

  list(limit = 50) {
    const rows = this._db.all('SELECT * FROM ai_concepts ORDER BY confidence DESC LIMIT ?', [limit]);
    return rows.map(r => this._hydrate(r));
  }

  stats() {
    const row = this._db.get('SELECT COUNT(*) as c, AVG(confidence) as avg FROM ai_concepts');
    return {
      conceptCount: row.c,
      avgConfidence: Math.round((row.avg || 0) * 100) / 100
    };
  }

  _hydrate(row) {
    let relations = [];
    try { relations = JSON.parse(row.relations || '[]'); } catch {}
    let metadata = {};
    try { metadata = JSON.parse(row.metadata || '{}'); } catch {}
    return {
      name: row.name,
      meaning: row.meaning || '',
      relations,
      confidence: row.confidence,
      history: metadata.history || [],
      createdAt: row.created_at
    };
  }
}

module.exports = ConceptMemory;
