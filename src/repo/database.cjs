const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

class Database {
  constructor(repoPath) {
    this.repoPath = repoPath;
    this.dbPath = path.join(repoPath, '.repo', 'database.sqlite');
    this.db = null;
  }

  async open() {
    await fs.ensureDir(path.join(this.repoPath, '.repo'));
    
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          // 启用外键约束（SQLite 默认关闭）
          this.db.run('PRAGMA foreign_keys = ON', (err2) => {
            if (err2) reject(err2);
            else resolve(this);
          });
        }
      });
    });
  }

  async init() {
    await this.open();
    await this.createTables();
    return this;
  }

  async createTables() {
    await this.run(`
      CREATE TABLE IF NOT EXISTS resources (
        rid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        layer INTEGER NOT NULL DEFAULT 0,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        hash TEXT,
        metadata TEXT DEFAULT '{}',
        encrypted INTEGER DEFAULT 0,
        created INTEGER NOT NULL,
        updated INTEGER NOT NULL,
        deleted INTEGER DEFAULT 0
      )
    `);

    // 数据迁移：为已有仓库添加 encrypted 列
    try {
      await this.run('ALTER TABLE resources ADD COLUMN encrypted INTEGER DEFAULT 0');
    } catch {
      // 列已存在，忽略
    }

    // 数据迁移：为已有仓库添加 name 列（资源逻辑名称，全局唯一）
    try {
      await this.run('ALTER TABLE resources ADD COLUMN name TEXT');
    } catch {
      // 列已存在，忽略
    }

    // 数据迁移：为已有仓库添加 layer 列（栈层级，0=活跃，1~19=栈）
    try {
      await this.run('ALTER TABLE resources ADD COLUMN layer INTEGER NOT NULL DEFAULT 0');
    } catch {
      // 列已存在，忽略
    }

    // 数据迁移：为已有仓库添加 capabilities 列（JSON 数组，如 ["container"]）
    try {
      await this.run('ALTER TABLE resources ADD COLUMN capabilities TEXT DEFAULT \'[]\'');
    } catch {
      // 列已存在，忽略
    }

    // 数据迁移：为已有仓库添加 container_schema 列（JSON 对象，定义容器规则）
    try {
      await this.run('ALTER TABLE resources ADD COLUMN container_schema TEXT DEFAULT \'{}\'');
    } catch {
      // 列已存在，忽略
    }

    await this.run(`
      CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_rid TEXT NOT NULL,
        to_rid TEXT NOT NULL,
        type TEXT NOT NULL,
        created INTEGER NOT NULL,
        UNIQUE(from_rid, to_rid, type)
      )
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type)
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_resources_path ON resources(path)
    `);

    // 删除旧的单列 name 唯一索引（迁移兼容）
    try {
      await this.run('DROP INDEX IF EXISTS idx_resources_name');
    } catch {
      // 忽略
    }

    await this.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_name_layer ON resources(name, layer)
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_rid)
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_rid)
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        action TEXT NOT NULL,
        path TEXT,
        details TEXT
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS sync_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS commits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        added INTEGER DEFAULT 0,
        updated INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0,
        renamed INTEGER DEFAULT 0,
        metadata INTEGER DEFAULT 0,
        merge INTEGER DEFAULT 0
      )
    `);

    // 数据迁移：为已有仓库的 commits 表添加 updated 列
    try {
      await this.run('ALTER TABLE commits ADD COLUMN updated INTEGER DEFAULT 0');
    } catch {
      // 列已存在，忽略
    }

    // 数据迁移：为已有仓库的 commits 表添加 metadata 列
    try {
      await this.run('ALTER TABLE commits ADD COLUMN metadata INTEGER DEFAULT 0');
    } catch {
      // 列已存在，忽略
    }

    // 数据迁移：为已有仓库的 commits 表添加 merge 列（标识合并提交）
    try {
      await this.run('ALTER TABLE commits ADD COLUMN merge INTEGER DEFAULT 0');
    } catch {
      // 列已存在，忽略
    }

    // 同步操作日志（用于跨设备同步）
    await this.run(`
      CREATE TABLE IF NOT EXISTS sync_ops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        op_id TEXT NOT NULL UNIQUE,
        op_type TEXT NOT NULL,
        rid TEXT,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        applied INTEGER DEFAULT 1
      )
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_sync_ops_timestamp ON sync_ops(timestamp)
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_sync_ops_device ON sync_ops(device_id)
    `);

    // ── Resource、Container Capability 与 Member 模型 ──

    // Content Source 表：关联 Resource 与实际内容来源
    await this.run(`
      CREATE TABLE IF NOT EXISTS resource_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_rid TEXT NOT NULL,
        source_type TEXT NOT NULL,
        location TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        sync_mode TEXT DEFAULT 'manual',
        last_scan_at INTEGER,
        metadata TEXT DEFAULT '{}',
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (resource_rid) REFERENCES resources(rid) ON DELETE CASCADE
      )
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_resource_sources_rid ON resource_sources(resource_rid)
    `);

    // 迁移：为旧 resource_sources 增加 enabled/sync_mode/last_scan_at/created_at/updated_at 列
    await this._migrateResourceSourcesV1();

    // Container Members 表：具有 Container Capability 的 Resource 的成员
    await this.run('PRAGMA foreign_keys = ON');
    await this.run(`
      CREATE TABLE IF NOT EXISTS container_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        container_rid TEXT NOT NULL,
        source_id INTEGER,
        resource_rid TEXT,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        size INTEGER DEFAULT 0,
        hash TEXT,
        modified_time INTEGER,
        status TEXT DEFAULT 'indexed',
        force_ignore INTEGER DEFAULT 0,
        source_deleted_at DATETIME,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now')),
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (container_rid) REFERENCES resources(rid) ON DELETE CASCADE,
        FOREIGN KEY (resource_rid) REFERENCES resources(rid) ON DELETE SET NULL,
        FOREIGN KEY (source_id) REFERENCES resource_sources(id) ON DELETE SET NULL
      )
    `);

    // 迁移：为旧数据库增加 status 列
    await this._migrateContainerMembersV1();

    // 迁移：为旧数据库增加 force_ignore 列
    await this._migrateContainerMembersV2();

    // 迁移：增加 source_id，将 ignored 成员转为 force_ignore
    await this._migrateContainerMembersV3();

    // 迁移：增加 FOREIGN KEY 和 UNIQUE 约束
    await this._migrateContainerMembersV4();

    // 迁移：增加 source_deleted_at 列
    await this._migrateContainerMembersV5();

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_container_members_container ON container_members(container_rid)
    `);

    await this.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_container_members_path ON container_members(container_rid, source_id, path)
    `);

    // container_sync_configs 表（Phase 3.5）
    await this._createSyncConfigsTable();

    // Phase 4.2: container_operations 表
    await this._migrateContainerOperationsV6();

    // V7: container_operations 扩展字段
    await this._migrateContainerOperationsV7();

    // V8: container_transactions + transaction_id
    await this._migrateContainerTransactionsV8();

    // V9: relations 表升级（Phase 5.1）
    await this._migrateRelationsV9();
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 迁移 container_members 表：增加 status、created_at、updated_at 列
   * 并为已有数据设置正确的 status 值
   */
  async _migrateContainerMembersV1() {
    try {
      // 检查 status 列是否存在
      const colCheck = await this.get(
        `PRAGMA table_info(container_members)`
      );
      // PRAGMA table_info 会返回多行，需要用 all
      const columns = await this.all(`PRAGMA table_info(container_members)`);
      const hasStatus = columns.some(c => c.name === 'status');

      if (!hasStatus) {
        console.log('[migrate] 为 container_members 增加 status/created_at/updated_at 列...');
        await this.run(`ALTER TABLE container_members ADD COLUMN status TEXT DEFAULT 'indexed'`);
        await this.run(`ALTER TABLE container_members ADD COLUMN created_at DATETIME DEFAULT (datetime('now'))`);
        await this.run(`ALTER TABLE container_members ADD COLUMN updated_at DATETIME DEFAULT (datetime('now'))`);

        // 已有 resource_rid 的 → promoted
        await this.run(
          `UPDATE container_members SET status = 'promoted' WHERE resource_rid IS NOT NULL`
        );
        console.log('[migrate] container_members 迁移完成');
      }
    } catch (e) {
      // 列已存在时 ALTER TABLE 会报错，忽略
      if (!e.message.includes('duplicate column')) {
        console.error('[migrate] container_members 迁移失败:', e.message);
      }
    }
  }

  /**
   * 迁移 resource_sources 表：增加 enabled/sync_mode/last_scan_at/created_at/updated_at 列
   */
  async _migrateResourceSourcesV1() {
    try {
      const columns = await this.all(`PRAGMA table_info(resource_sources)`);
      const hasEnabled = columns.some(c => c.name === 'enabled');

      if (!hasEnabled) {
        console.log('[migrate] 为 resource_sources 增加 enabled/sync_mode/last_scan_at/created_at/updated_at 列...');
        await this.run(`ALTER TABLE resource_sources ADD COLUMN enabled INTEGER DEFAULT 1`);
        await this.run(`ALTER TABLE resource_sources ADD COLUMN sync_mode TEXT DEFAULT 'manual'`);
        await this.run(`ALTER TABLE resource_sources ADD COLUMN last_scan_at INTEGER`);
        await this.run(`ALTER TABLE resource_sources ADD COLUMN created_at INTEGER`);
        await this.run(`ALTER TABLE resource_sources ADD COLUMN updated_at INTEGER`);
        console.log('[migrate] resource_sources 迁移完成');
      }
    } catch (e) {
      if (!e.message.includes('duplicate column')) {
        console.error('[migrate] resource_sources 迁移失败:', e.message);
      }
    }
  }

  /**
   * 迁移 container_members 表：增加 force_ignore 列
   */
  async _migrateContainerMembersV2() {
    try {
      const columns = await this.all(`PRAGMA table_info(container_members)`);
      const hasForce = columns.some(c => c.name === 'force_ignore');

      if (!hasForce) {
        console.log('[migrate] 为 container_members 增加 force_ignore 列...');
        await this.run(`ALTER TABLE container_members ADD COLUMN force_ignore INTEGER DEFAULT 0`);
        console.log('[migrate] container_members V2 迁移完成');
      }
    } catch (e) {
      if (!e.message.includes('duplicate column')) {
        console.error('[migrate] container_members V2 迁移失败:', e.message);
      }
    }
  }

  /**
   * 迁移 container_members 表 V3：
   *   - 增加 source_id 列
   *   - 将 status='ignored' 迁移为 status='indexed' + force_ignore=1
   */
  async _migrateContainerMembersV3() {
    try {
      const columns = await this.all(`PRAGMA table_info(container_members)`);
      const hasSourceId = columns.some(c => c.name === 'source_id');

      if (!hasSourceId) {
        console.log('[migrate] container_members V3: 增加 source_id 列...');
        await this.run(`ALTER TABLE container_members ADD COLUMN source_id INTEGER DEFAULT 0`);
      }

      // 无论 source_id 是否新增，都检查并迁移 ignored 状态
      const ignoredCount = await this.get(
        `SELECT COUNT(*) as cnt FROM container_members WHERE status = 'ignored'`
      );
      if (ignoredCount.cnt > 0) {
        console.log(`[migrate] container_members V3: ${ignoredCount.cnt} 个 ignored 成员转为 indexed + force_ignore=1`);
        await this.run(
          `UPDATE container_members SET status = 'indexed', force_ignore = 1, updated_at = datetime('now') WHERE status = 'ignored'`
        );
      }

      if (!hasSourceId) {
        console.log('[migrate] container_members V3 迁移完成');
      }
    } catch (e) {
      if (!e.message.includes('duplicate column')) {
        console.error('[migrate] container_members V3 迁移失败:', e.message);
      }
    }
  }

  /**
   * 创建 container_sync_configs 表（Phase 3.5 新增）
   */
  async _createSyncConfigsTable() {
    const tables = await this.all(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='container_sync_configs'`
    );
    if (tables.length > 0) return;

    console.log('[migrate] 创建 container_sync_configs 表...');
    await this.run(`
      CREATE TABLE container_sync_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        container_rid TEXT NOT NULL,
        source_id INTEGER NOT NULL,
        sync_mode TEXT DEFAULT 'manual',
        delete_policy TEXT DEFAULT 'soft',
        conflict_policy TEXT DEFAULT 'local',
        interval_ms INTEGER,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (container_rid) REFERENCES resources(rid) ON DELETE CASCADE,
        FOREIGN KEY (source_id) REFERENCES resource_sources(id) ON DELETE CASCADE
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_sync_configs_container ON container_sync_configs(container_rid)`);
    await this.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_configs_pair ON container_sync_configs(container_rid, source_id)`);
    console.log('[migrate] container_sync_configs 创建完成');
  }

  /**
   * 迁移 container_members 表 V4：增加 FK(source_id) 和 UNIQUE(container_rid,source_id,path)
   *
   * SQLite 不支持 ALTER TABLE ADD CONSTRAINT，因此采用重建表的方式。
   * 先清理孤儿数据，再通过 PRAGMA foreign_key_list 判断是否需要重建。
   */
  async _migrateContainerMembersV4() {
    try {
      // 1. 清理孤儿 + 存量 source_id=0 → NULL（0 不是合法 FK 引用）
      const orphanCount = await this.get(
        `SELECT COUNT(*) as cnt FROM container_members cm
         WHERE cm.source_id != 0 AND cm.source_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM resource_sources rs WHERE rs.id = cm.source_id)`
      );
      if (orphanCount && orphanCount.cnt > 0) {
        console.log(`[migrate] container_members V4: 清理 ${orphanCount.cnt} 个孤儿 source_id`);
        await this.run('PRAGMA foreign_keys = OFF');
        await this.run(
          `UPDATE container_members SET source_id = NULL
           WHERE source_id IS NOT NULL AND source_id != 0
           AND NOT EXISTS (SELECT 1 FROM resource_sources rs WHERE rs.id = container_members.source_id)`
        );
        await this.run('PRAGMA foreign_keys = ON');
      }

      // 存量 source_id=0 → NULL（与 FK 对齐）
      const zeroCount = await this.get(
        `SELECT COUNT(*) as cnt FROM container_members WHERE source_id = 0`
      );
      if (zeroCount && zeroCount.cnt > 0) {
        console.log(`[migrate] container_members V4: 将 ${zeroCount.cnt} 个 source_id=0 转为 NULL`);
        await this.run('PRAGMA foreign_keys = OFF');
        await this.run('UPDATE container_members SET source_id = NULL WHERE source_id = 0');
        await this.run('PRAGMA foreign_keys = ON');
      }

      // 2. 检查是否需要重建表（通过检查 FK 是否存在）
      const fkList = await this.all(`PRAGMA foreign_key_list(container_members)`);
      const hasSourceFk = fkList.some(fk => fk.from === 'source_id');

      if (!hasSourceFk) {
        console.log('[migrate] container_members V4: 重建表以添加 source_id FK 和 UNIQUE 约束...');

        // 开启外键支持
        await this.run('PRAGMA foreign_keys = ON');

        // 步骤：创建新表 → 复制数据 → 删旧表 → 重命名
        await this.run('BEGIN TRANSACTION');

        try {
          await this.run(`
            CREATE TABLE container_members_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              container_rid TEXT NOT NULL,
              source_id INTEGER,
              resource_rid TEXT,
              path TEXT NOT NULL,
              name TEXT NOT NULL,
              size INTEGER DEFAULT 0,
              hash TEXT,
              modified_time INTEGER,
              status TEXT DEFAULT 'indexed',
              force_ignore INTEGER DEFAULT 0,
              source_deleted_at DATETIME,
              created_at DATETIME DEFAULT (datetime('now')),
              updated_at DATETIME DEFAULT (datetime('now')),
              metadata TEXT DEFAULT '{}',
              FOREIGN KEY (container_rid) REFERENCES resources(rid) ON DELETE CASCADE,
              FOREIGN KEY (resource_rid) REFERENCES resources(rid) ON DELETE SET NULL,
              FOREIGN KEY (source_id) REFERENCES resource_sources(id) ON DELETE SET NULL
            )
          `);

          await this.run(
            `INSERT INTO container_members_new SELECT * FROM container_members`
          );

          await this.run(`DROP TABLE container_members`);
          await this.run(`ALTER TABLE container_members_new RENAME TO container_members`);

          await this.run(`CREATE INDEX IF NOT EXISTS idx_container_members_container ON container_members(container_rid)`);
          await this.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_container_members_path ON container_members(container_rid, source_id, path)`);

          await this.run('COMMIT');
          console.log('[migrate] container_members V4 重建完成');
        } catch (recreateError) {
          await this.run('ROLLBACK');
          throw recreateError;
        }
      } else {
        // FK 已存在，只需确保 UNIQUE 索引包含 source_id
        const indexList = await this.all(`PRAGMA index_list(container_members)`);
        const hasPathIdx = indexList.some(idx => idx.name === 'idx_container_members_path');
        if (hasPathIdx) {
          // 检查索引是否已包含 source_id
          const idxInfo = await this.all(`PRAGMA index_info(idx_container_members_path)`);
          const hasSourceInIdx = idxInfo.some(col => col.name === 'source_id');
          if (!hasSourceInIdx) {
            // 重建唯一索引
            await this.run(`DROP INDEX IF EXISTS idx_container_members_path`);
            await this.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_container_members_path ON container_members(container_rid, source_id, path)`);
            console.log('[migrate] container_members V4: 唯一索引已更新为包含 source_id');
          }
        }
      }
    } catch (e) {
      console.error('[migrate] container_members V4 迁移失败:', e.message);
    }
  }

  /**
   * 迁移 container_members 表 V5：增加 source_deleted_at 列
   */
  async _migrateContainerMembersV5() {
    try {
      const columns = await this.all(`PRAGMA table_info(container_members)`);
      const hasCol = columns.some(c => c.name === 'source_deleted_at');

      if (!hasCol) {
        console.log('[migrate] container_members V5: 增加 source_deleted_at 列...');
        await this.run(`ALTER TABLE container_members ADD COLUMN source_deleted_at DATETIME`);
        console.log('[migrate] container_members V5 迁移完成');
      }
    } catch (e) {
      if (!e.message.includes('duplicate column')) {
        console.error('[migrate] container_members V5 迁移失败:', e.message);
      }
    }
  }

  /**
   * V6: 创建 container_operations 表（Operation 历史系统）
   */
  async _migrateContainerOperationsV6() {
    try {
      await this.run(`
        CREATE TABLE IF NOT EXISTS container_operations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          operation_id TEXT UNIQUE NOT NULL,
          container_rid TEXT NOT NULL,
          type TEXT NOT NULL,
          member_id INTEGER,
          member_path TEXT,
          source_id INTEGER,
          before TEXT,
          after TEXT,
          created INTEGER NOT NULL,
          FOREIGN KEY(container_rid) REFERENCES resources(rid) ON DELETE CASCADE,
          FOREIGN KEY(member_id) REFERENCES container_members(id) ON DELETE SET NULL
        )
      `);
      await this.run(`CREATE INDEX IF NOT EXISTS idx_ops_container ON container_operations(container_rid)`);
      await this.run(`CREATE INDEX IF NOT EXISTS idx_ops_type ON container_operations(type)`);
      await this.run(`CREATE INDEX IF NOT EXISTS idx_ops_member ON container_operations(member_id)`);
    } catch (e) {
      console.error('[migrate] container_operations V6 创建失败:', e.message);
    }
  }

  /**
   * V7: container_operations 扩展字段（status / parent_operation_id / error / actor）
   */
  async _migrateContainerOperationsV7() {
    try {
      // 逐列尝试 ALTER，忽略已存在的列
      const cols = [
        ["status", "TEXT DEFAULT 'success'"],
        ["parent_operation_id", "TEXT"],
        ["error", "TEXT"],
        ["actor", "TEXT"]
      ];
      for (const [col, def] of cols) {
        try {
          await this.run(`ALTER TABLE container_operations ADD COLUMN ${col} ${def}`);
        } catch (e) {
          // 列已存在，跳过
        }
      }
      await this.run(`CREATE INDEX IF NOT EXISTS idx_ops_parent ON container_operations(parent_operation_id)`);
      await this.run(`CREATE INDEX IF NOT EXISTS idx_ops_status ON container_operations(status)`);
    } catch (e) {
      console.error('[migrate] container_operations V7 失败:', e.message);
    }
  }

  /**
   * V8: container_transactions 表 + transaction_id 列
   */
  async _migrateContainerTransactionsV8() {
    try {
      // 创建 container_transactions 表
      await this.run(`
        CREATE TABLE IF NOT EXISTS container_transactions (
          transaction_id TEXT PRIMARY KEY,
          container_rid TEXT NOT NULL,
          type TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created INTEGER,
          completed INTEGER,
          error TEXT,
          FOREIGN KEY(container_rid) REFERENCES resources(rid) ON DELETE CASCADE
        )
      `);
      await this.run(`CREATE INDEX IF NOT EXISTS idx_tx_container ON container_transactions(container_rid)`);
      await this.run(`CREATE INDEX IF NOT EXISTS idx_tx_status ON container_transactions(status)`);

      // 为 container_operations 增加 transaction_id 列
      try {
        await this.run(`ALTER TABLE container_operations ADD COLUMN transaction_id TEXT`);
      } catch (e) { /* 列已存在 */ }
      await this.run(`CREATE INDEX IF NOT EXISTS idx_ops_transaction ON container_operations(transaction_id)`);
    } catch (e) {
      console.error('[migrate] container_transactions V8 失败:', e.message);
    }
  }

  /**
   * V9: relations 表升级 — 增加 metadata、updated、deleted 字段 + 索引
   * Phase 5.1
   */
  async _migrateRelationsV9() {
    try {
      // 新增字段（ALTER TABLE ADD COLUMN，已存在则忽略）
      for (const col of [
        { name: 'metadata', def: "TEXT DEFAULT '{}'" },
        { name: 'updated', def: 'INTEGER' },
        { name: 'deleted', def: 'INTEGER DEFAULT 0' }
      ]) {
        try {
          await this.run(`ALTER TABLE relations ADD COLUMN ${col.name} ${col.def}`);
        } catch (e) { /* 列已存在 */ }
      }

      // 索引
      await this.run(`CREATE INDEX IF NOT EXISTS idx_relations_deleted ON relations(deleted)`);

      // Phase 5.2: 确保 __system__ 资源存在（用于 relation 等非容器操作）
      await this.run(
        `INSERT OR IGNORE INTO resources (rid, name, layer, type, path, hash, metadata, encrypted, created, updated)
         VALUES ('__system__', '__system__', 0, 'system', '', '', '{}', 0, ?, ?)`,
        [Date.now(), Date.now()]
      );
    } catch (e) {
      console.error('[migrate] relations V9 失败:', e.message);
    }
  }

  /**
   * @private
   */
  async _noop() {}
}

module.exports = Database;