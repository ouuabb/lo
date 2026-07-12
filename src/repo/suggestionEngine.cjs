/**
 * SuggestionEngine — AI 建议管理引擎
 *
 * Phase 5.8: 管理 AI 生成的知识建议生命周期。
 * 建议状态: pending → approved / rejected
 *
 * 不直接修改 Resource/Relation 模型。
 * approved 后由 OperationEngine 执行。
 */

const { nanoid } = (() => {
  try { return require('nanoid'); } catch {
    return {
      nanoid: (n = 12) => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let id = '';
        for (let i = 0; i < n; i++) id += chars[Math.floor(Math.random() * chars.length)];
        return id;
      }
    };
  }
})();

class SuggestionEngine {
  /**
   * @param {import('./database.cjs')} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * 创建建议
   * @param {{ type?: string, source?: string, target?: string, confidence?: number, reason?: string, payload?: object }} data
   * @returns {Promise<object>}
   */
  async create(data = {}) {
    const id = nanoid(16);
    const now = Date.now();

    await this.db.run(
      `INSERT INTO ai_suggestions (id, type, source_rid, target_rid, payload, confidence, reason, status, created, updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id,
        data.type || 'relation',
        data.source || null,
        data.target || null,
        JSON.stringify(data.payload || {}),
        data.confidence || 0,
        data.reason || '',
        now,
        now
      ]
    );

    return this.get(id);
  }

  /**
   * 批量创建建议
   * @param {Array} suggestions
   */
  async createBatch(suggestions) {
    const results = [];
    for (const s of suggestions) {
      results.push(await this.create(s));
    }
    return results;
  }

  /**
   * 获取建议
   */
  async get(id) {
    const row = await this.db.get('SELECT * FROM ai_suggestions WHERE id = ?', [id]);
    return row ? this._parse(row) : null;
  }

  /**
   * 列表建议
   * @param {{ status?: string, limit?: number }} options
   */
  async list(options = {}) {
    const { status, limit = 50 } = options;
    let sql = 'SELECT * FROM ai_suggestions';
    const params = [];

    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY confidence DESC, created DESC LIMIT ?';
    params.push(limit);

    const rows = await this.db.all(sql, params);
    return rows.map(r => this._parse(r));
  }

  /**
   * 批准建议 — 只改状态，不执行操作
   */
  async approve(id) {
    await this.db.run(
      `UPDATE ai_suggestions SET status = 'approved', updated = ? WHERE id = ?`,
      [Date.now(), id]
    );
    return this.get(id);
  }

  /**
   * 拒绝建议
   */
  async reject(id) {
    await this.db.run(
      `UPDATE ai_suggestions SET status = 'rejected', updated = ? WHERE id = ?`,
      [Date.now(), id]
    );
    return this.get(id);
  }

  /**
   * 统计
   */
  async stats() {
    const [total, pending, approved, rejected] = await Promise.all([
      this.db.get('SELECT COUNT(*) as c FROM ai_suggestions'),
      this.db.get("SELECT COUNT(*) as c FROM ai_suggestions WHERE status = 'pending'"),
      this.db.get("SELECT COUNT(*) as c FROM ai_suggestions WHERE status = 'approved'"),
      this.db.get("SELECT COUNT(*) as c FROM ai_suggestions WHERE status = 'rejected'")
    ]);

    return {
      total: total ? total.c : 0,
      pending: pending ? pending.c : 0,
      approved: approved ? approved.c : 0,
      rejected: rejected ? rejected.c : 0
    };
  }

  /** @private */
  _parse(row) {
    return {
      id: row.id,
      type: row.type,
      source: row.source_rid,
      target: row.target_rid,
      payload: this._json(row.payload),
      confidence: row.confidence,
      reason: row.reason,
      status: row.status,
      created: row.created,
      updated: row.updated
    };
  }

  /** @private */
  _json(str) {
    try { return JSON.parse(str || '{}'); } catch { return {}; }
  }
}

module.exports = SuggestionEngine;
