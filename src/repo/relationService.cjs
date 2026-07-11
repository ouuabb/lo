/**
 * RelationService — 资源关系服务
 *
 * Phase 5.1: 从简单 CRUD 升级为完整的关系子系统。
 * 特性：
 *   - 软删除（deleted 字段）
 *   - metadata 自定义属性
 *   - 按 id 精确操作
 *
 * 检索时默认排除已删除关系。
 */

class RelationService {
  constructor(db) {
    this.db = db;
  }

  /**
   * 创建关系
   * @param {string} fromRid
   * @param {string} toRid
   * @param {string} type
   * @param {object} [metadata]
   * @returns {Promise<object>}
   */
  async create(fromRid, toRid, type = 'reference', metadata = {}) {
    const now = Date.now();
    const metaJson = JSON.stringify(metadata);

    try {
      const result = await this.db.run(
        `INSERT INTO relations (from_rid, to_rid, type, metadata, created, updated)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [fromRid, toRid, type, metaJson, now, now]
      );

      return {
        id: result.lastID,
        from_rid: fromRid,
        to_rid: toRid,
        type,
        metadata,
        created: now,
        updated: now
      };
    } catch (e) {
      if (e.message.includes('UNIQUE')) {
        throw new Error('关系已存在');
      }
      throw e;
    }
  }

  /**
   * 软删除关系
   * @param {number} id
   * @returns {Promise<{ removed: boolean }>}
   */
  async remove(id) {
    const result = await this.db.run(
      `UPDATE relations SET deleted = ?, updated = ? WHERE id = ? AND deleted = 0`,
      [Date.now(), Date.now(), id]
    );
    if (result.changes === 0) {
      throw new Error(`关系不存在或已删除: ${id}`);
    }
    return { removed: true, id };
  }

  /**
   * 物理删除（按 from_rid, to_rid, type）
   * 保留用于向后兼容（wikilink 同步等场景）
   */
  async removeByTriple(fromRid, toRid, type) {
    const result = await this.db.run(
      `DELETE FROM relations WHERE from_rid = ? AND to_rid = ? AND type = ?`,
      [fromRid, toRid, type]
    );
    return { removed: result.changes > 0 };
  }

  /**
   * Phase 5.2: 恢复软删除的关系（用于 undo relation.remove）
   */
  async restore(fromRid, toRid, type) {
    const result = await this.db.run(
      `UPDATE relations SET deleted = 0, updated = ? WHERE from_rid = ? AND to_rid = ? AND type = ? AND deleted != 0`,
      [Date.now(), fromRid, toRid, type]
    );
    if (result.changes === 0) {
      throw new Error('找不到已删除的关系进行恢复');
    }
    return this.getByTriple(fromRid, toRid, type);
  }

  /**
   * Phase 5.2: 按 triple 获取（包含已删除）
   */
  async getByTriple(fromRid, toRid, type) {
    const row = await this.db.get(
      `SELECT * FROM relations WHERE from_rid = ? AND to_rid = ? AND type = ?`,
      [fromRid, toRid, type]
    );
    return row ? this._hydrate(row) : null;
  }

  /**
   * 更新关系（type 或 metadata）
   * @param {number} id
   * @param {{ type?: string, metadata?: object }} updates
   */
  async update(id, updates = {}) {
    const now = Date.now();
    const sets = ['updated = ?'];
    const params = [now];

    if (updates.type !== undefined) {
      sets.push('type = ?');
      params.push(updates.type);
    }
    if (updates.metadata !== undefined) {
      sets.push('metadata = ?');
      params.push(JSON.stringify(updates.metadata));
    }

    params.push(id);
    await this.db.run(
      `UPDATE relations SET ${sets.join(', ')} WHERE id = ? AND deleted = 0`,
      params
    );

    return this.getById(id);
  }

  /**
   * 按 id 获取关系
   */
  async getById(id) {
    const row = await this.db.get(
      `SELECT * FROM relations WHERE id = ? AND deleted = 0`,
      [id]
    );
    return row ? this._hydrate(row) : null;
  }

  /**
   * 获取资源的对外关系（outgoing）
   */
  async getByFromRid(rid) {
    const rows = await this.db.all(
      `SELECT * FROM relations WHERE from_rid = ? AND deleted = 0 ORDER BY created DESC`,
      [rid]
    );
    return rows.map(r => this._hydrate(r));
  }

  /**
   * 获取资源的被引用关系（incoming）
   */
  async getByToRid(rid) {
    const rows = await this.db.all(
      `SELECT * FROM relations WHERE to_rid = ? AND deleted = 0 ORDER BY created DESC`,
      [rid]
    );
    return rows.map(r => this._hydrate(r));
  }

  /**
   * 获取资源的完整关系（outgoing + incoming）
   */
  async getRelations(rid) {
    const outgoing = await this.getByFromRid(rid);
    const incoming = await this.getByToRid(rid);
    return { outgoing, incoming };
  }

  /**
   * 按类型过滤关系
   */
  async getByType(type) {
    const rows = await this.db.all(
      `SELECT * FROM relations WHERE type = ? AND deleted = 0 ORDER BY created DESC`,
      [type]
    );
    return rows.map(r => this._hydrate(r));
  }

  /**
   * 列出所有关系（支持过滤）
   * @param {{ type?: string, includeDeleted?: boolean, limit?: number }} filter
   */
  async listAll(filter = {}) {
    const { type, includeDeleted = false, limit = 100 } = filter;
    let sql = 'SELECT * FROM relations';
    const conditions = [];
    const params = [];

    if (!includeDeleted) {
      conditions.push('deleted = 0');
    }
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created DESC LIMIT ?';
    params.push(limit);

    const rows = await this.db.all(sql, params);
    return rows.map(r => this._hydrate(r));
  }

  /**
   * 创建双向关系
   */
  async createBidirectional(ridA, ridB, type = 'reference', metadata = {}) {
    const a = await this.create(ridA, ridB, type, metadata);
    const b = await this.create(ridB, ridA, type, metadata);
    return { a, b };
  }

  /**
   * 统计关系数量
   */
  async count(filter = {}) {
    const { type } = filter;
    let sql = 'SELECT COUNT(*) as count FROM relations WHERE deleted = 0';
    const params = [];
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    const row = await this.db.get(sql, params);
    return row.count;
  }

  /**
   * @private
   */
  _hydrate(row) {
    return {
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }
}

module.exports = RelationService;
