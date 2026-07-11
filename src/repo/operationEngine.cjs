/**
 * OperationEngine - 操作引擎
 *
 * 统一入口：所有 Container Member 变更都通过 OperationEngine.execute() 执行。
 * 职责：
 *   1. 通过 Registry 查找 handler
 *   2. 管理操作状态生命周期（pending → success | failed | rollback）
 *   3. 持久化操作记录到 container_operations
 *   4. 支持 undo（产生父子操作链）
 *
 * Phase 4.3
 */

const crypto = require('crypto');

class OperationEngine {
  /**
   * @param {import('./database.cjs')} db
   * @param {import('./operationRegistry.cjs')} registry
   * @param {import('./containerService.cjs')} containerService
   */
  constructor(db, registry, containerService) {
    this.db = db;
    this.registry = registry;
    this.containerService = containerService;
  }

  _genOpId() {
    return 'op_' + crypto.randomBytes(5).toString('hex');
  }

  /**
   * 执行一个操作
   *
   * @param {string} type - 操作类型，如 'member.rename'
   * @param {object} params - handler 所需参数（containerRid, memberPath, 等）
   * @param {{ actor?: string, parentOperationId?: string }} options
   * @returns {Promise<{ operationId: string, result: object }>}
   */
  async execute(type, params, options = {}) {
    const { actor = null, parentOperationId = null, transactionId = null } = options;

    const handler = this.registry.get(type);
    const operationId = this._genOpId();
    const containerRid = params.containerRid || params.container_rid;
    const memberPath = params.memberPath || params.path || null;
    const now = Date.now();

    // 1. 写入 pending 状态
    await this.db.run(
      `INSERT INTO container_operations (operation_id, container_rid, type, member_path, source_id, status, parent_operation_id, transaction_id, actor, created)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [operationId, containerRid, type, memberPath, params.sourceId || null, parentOperationId, transactionId, actor, now]
    );

    // 2. 执行
    try {
      const ctx = { db: this.db, containerService: this.containerService };
      const result = await handler.execute(ctx, params);

      // 3. 成功 → 写入 after 快照
      await this.db.run(
        `UPDATE container_operations SET status = 'success', after = ? WHERE operation_id = ?`,
        [JSON.stringify(result), operationId]
      );

      return { operationId, result };
    } catch (err) {
      // 4. 失败 → 记录错误
      await this.db.run(
        `UPDATE container_operations SET status = 'failed', error = ? WHERE operation_id = ?`,
        [err.message, operationId]
      );
      throw err;
    }
  }

  /**
   * 撤销一个操作
   *
   * 产生新的操作记录（parent_operation_id 指向被撤销的操作），
   * 不删除原有历史。
   *
   * @param {string} operationId - 要撤销的操作 ID
   * @param {{ actor?: string }} options
   * @returns {Promise<{ undoOperationId: string, result: object }>}
   */
  async undo(operationId, options = {}) {
    const { actor = null } = options;

    const op = await this._getOp(operationId);
    if (!op) throw new Error(`操作不存在: ${operationId}`);
    if (op.status !== 'success') throw new Error(`只能撤销成功的操作，当前状态: ${op.status}`);

    // 检查是否已被撤销
    const alreadyUndone = await this.db.get(
      `SELECT id FROM container_operations WHERE parent_operation_id = ? AND status = 'success'`,
      [operationId]
    );
    if (alreadyUndone) {
      throw new Error(`操作已被撤销: ${operationId}`);
    }

    // Undo of an undo → re-execute the original operation
    if (op.type.startsWith('undo.')) {
      return this._redoUndo(op, actor);
    }

    const handler = this.registry.get(op.type);
    const after = op.after || {};
    const undoParams = {
      containerRid: op.container_rid,
      memberPath: op.member_path,
      sourceId: op.source_id,
      operationResult: after  // 正向操作的结果，undo 时需要用它来反推
    };

    // 创建 undo 操作记录
    const undoType = 'undo.' + op.type;
    const undoOperationId = this._genOpId();

    await this.db.run(
      `INSERT INTO container_operations (operation_id, container_rid, type, member_path, source_id, status, parent_operation_id, actor, before, created)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [undoOperationId, op.container_rid, undoType, op.member_path, op.source_id,
       operationId, actor, JSON.stringify(op.after), Date.now()]
    );

    try {
      const ctx = { db: this.db, containerService: this.containerService };
      const result = await handler.undo(ctx, undoParams);

      // 标记 undo 成功 + 原操作标记为 rolled_back
      await this.db.run(
        `UPDATE container_operations SET status = 'success', after = ? WHERE operation_id = ?`,
        [JSON.stringify(result), undoOperationId]
      );
      await this.db.run(
        `UPDATE container_operations SET status = 'rolled_back' WHERE operation_id = ?`,
        [operationId]
      );

      return { undoOperationId, result };
    } catch (err) {
      await this.db.run(
        `UPDATE container_operations SET status = 'failed', error = ? WHERE operation_id = ?`,
        [err.message, undoOperationId]
      );
      throw err;
    }
  }

  /**
   * 获取操作历史
   */
  async getHistory(containerRid, options = {}) {
    const { limit = 50, type = null } = options;

    let sql = `SELECT operation_id, type, status, member_path, parent_operation_id, error, actor, before, after, created
               FROM container_operations WHERE container_rid = ?`;
    const params = [containerRid];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created DESC LIMIT ?';
    params.push(limit);

    const rows = await this.db.all(sql, params);
    return rows.map(r => ({
      ...r,
      before: r.before ? JSON.parse(r.before) : null,
      after: r.after ? JSON.parse(r.after) : null
    }));
  }

  /**
   * 获取操作详情
   */
  async getOperation(operationId) {
    return this._getOp(operationId);
  }

  /**
   * 按事务查询操作列表
   */
  async getOperationsByTransaction(transactionId) {
    const rows = await this.db.all(
      `SELECT * FROM container_operations WHERE transaction_id = ? ORDER BY created ASC`,
      [transactionId]
    );
    return rows.map(r => ({
      ...r,
      before: r.before ? JSON.parse(r.before) : null,
      after: r.after ? JSON.parse(r.after) : null
    }));
  }

  /**
   * 获取特定成员的操作历史（按路径匹配）
   */
  async getMemberHistory(containerRid, memberPath) {
    const rows = await this.db.all(
      `SELECT * FROM container_operations
       WHERE container_rid = ?
       ORDER BY created DESC`,
      [containerRid]
    );

    return rows
      .map(r => {
        const before = r.before ? JSON.parse(r.before) : null;
        const after = r.after ? JSON.parse(r.after) : null;
        const matches =
          r.member_path === memberPath ||
          (before && (before.path === memberPath || before.oldPath === memberPath || before.container === memberPath)) ||
          (after && (after.path === memberPath || after.newPath === memberPath || after.container === memberPath));
        return matches ? { ...r, before, after } : null;
      })
      .filter(Boolean);
  }

  /**
   * @private
   */
  async _getOp(operationId) {
    const row = await this.db.get(
      'SELECT * FROM container_operations WHERE operation_id = ?',
      [operationId]
    );
    if (!row) return null;
    return {
      ...row,
      before: row.before ? JSON.parse(row.before) : null,
      after: row.after ? JSON.parse(row.after) : null
    };
  }

  /**
   * Undo-of-undo: 重新执行被撤销的原始操作
   * @private
   */
  async _redoUndo(undoOp, actor) {
    const parent = await this._getOp(undoOp.parent_operation_id);
    if (!parent) throw new Error('找不到被撤销的原始操作');

    const type = parent.type;
    const result = undoOp.before || {};  // undo's before = parent's after

    // 从 operation result 重建 execute 参数
    const handler = this.registry.get(type);
    const params = { containerRid: parent.container_rid, sourceId: parent.source_id, memberPath: parent.member_path };

    if (type === 'member.rename') {
      params.memberPath = result.oldPath;
      params.newPath = result.newPath;
    } else if (type === 'member.move') {
      params.targetContainerRid = result.to;
    } else if (type === 'member.copy') {
      params.targetContainerRid = result.to;
    }

    // 创建 redo 操作记录
    const redoOpId = this._genOpId();
    await this.db.run(
      `INSERT INTO container_operations (operation_id, container_rid, type, member_path, source_id, status, parent_operation_id, actor, before, created)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [redoOpId, parent.container_rid, type, parent.member_path, parent.source_id,
       undoOp.operation_id, actor, JSON.stringify(result), Date.now()]
    );

    try {
      const ctx = { db: this.db, containerService: this.containerService };
      const redoResult = await handler.execute(ctx, params);

      await this.db.run(
        `UPDATE container_operations SET status = 'success', after = ? WHERE operation_id = ?`,
        [JSON.stringify(redoResult), redoOpId]
      );
      await this.db.run(
        `UPDATE container_operations SET status = 'rolled_back' WHERE operation_id = ?`,
        [undoOp.operation_id]
      );

      return { undoOperationId: redoOpId, result: redoResult };
    } catch (err) {
      await this.db.run(
        `UPDATE container_operations SET status = 'failed', error = ? WHERE operation_id = ?`,
        [err.message, redoOpId]
      );
      throw err;
    }
  }
}

module.exports = OperationEngine;
