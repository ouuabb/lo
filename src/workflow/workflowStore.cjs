/**
 * WorkflowStore — 工作流持久化
 *
 * Phase 6.3: 保存和查询工作流定义、执行记录。
 */

class WorkflowStore {
  /**
   * @param {import('../repo/database.cjs')} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * 保存工作流定义
   */
  async saveDefinition(workflow) {
    await this.db.run(
      `INSERT OR REPLACE INTO workflows (id, name, definition, status, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [workflow.id, workflow.name, JSON.stringify(workflow.toJSON()), workflow.status, workflow.createdAt]
    );
  }

  /**
   * 获取工作流定义
   */
  async getDefinition(id) {
    const row = await this.db.get('SELECT * FROM workflows WHERE id = ?', [id]);
    if (!row) return null;
    return JSON.parse(row.definition);
  }

  /**
   * 列出所有工作流定义
   */
  async listDefinitions() {
    const rows = await this.db.all(
      'SELECT id, name, status, created_at FROM workflows ORDER BY created_at DESC'
    );
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      status: r.status,
      createdAt: r.created_at
    }));
  }

  /**
   * 删除工作流定义
   */
  async deleteDefinition(id) {
    await this.db.run('DELETE FROM workflows WHERE id = ?', [id]);
  }

  /**
   * 保存执行记录
   */
  async saveExecution(context) {
    const row = await this.db.get(
      'SELECT id FROM workflow_executions WHERE id = ?',
      [context.executionId]
    );

    if (row) {
      await this.db.run(
        `UPDATE workflow_executions
         SET status = ?, context = ?, updated_at = ?
         WHERE id = ?`,
        [context.status, JSON.stringify(context.toJSON()), Date.now(), context.executionId]
      );
    } else {
      await this.db.run(
        `INSERT INTO workflow_executions (id, workflow_id, status, context, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [context.executionId, context.workflowId, context.status,
         JSON.stringify(context.toJSON()), Date.now(), Date.now()]
      );
    }
  }

  /**
   * 查询执行历史
   */
  async listExecutions(workflowId, limit = 20) {
    let sql = 'SELECT * FROM workflow_executions';
    const params = [];

    if (workflowId) {
      sql += ' WHERE workflow_id = ?';
      params.push(workflowId);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = await this.db.all(sql, params);
    return rows.map(r => ({
      id: r.id,
      workflowId: r.workflow_id,
      status: r.status,
      context: r.context ? JSON.parse(r.context) : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  /**
   * 获取执行记录
   */
  async getExecution(executionId) {
    const row = await this.db.get(
      'SELECT * FROM workflow_executions WHERE id = ?',
      [executionId]
    );
    if (!row) return null;
    return {
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      context: row.context ? JSON.parse(row.context) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = WorkflowStore;
