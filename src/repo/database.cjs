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
    // ======================== 核心资源表 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS resources (
        rid               TEXT PRIMARY KEY,
        name              TEXT NOT NULL,
        layer             INTEGER NOT NULL DEFAULT 0,
        type              TEXT NOT NULL,
        path              TEXT NOT NULL,
        hash              TEXT,
        metadata          TEXT DEFAULT '{}',
        encrypted         INTEGER DEFAULT 0,
        created           INTEGER NOT NULL,
        updated           INTEGER NOT NULL,
        deleted           INTEGER DEFAULT 0,
        container_schema  TEXT DEFAULT '{}'
      )
    `);

    await this.run(`CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_resources_path ON resources(path)`);
    await this.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_name_layer ON resources(name, layer)`);

    // 删除旧的单列 name 唯一索引（兼容旧库）
    try { await this.run('DROP INDEX IF EXISTS idx_resources_name'); } catch {}

    // ======================== 标签 / 能力 / 容器忽略模式 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS resource_tags (
        resource_rid  TEXT NOT NULL,
        tag           TEXT NOT NULL,
        PRIMARY KEY (resource_rid, tag),
        FOREIGN KEY (resource_rid) REFERENCES resources(rid) ON DELETE CASCADE
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_rt_tag ON resource_tags(tag)`);

    await this.run(`
      CREATE TABLE IF NOT EXISTS resource_capabilities (
        resource_rid  TEXT NOT NULL,
        capability    TEXT NOT NULL,
        PRIMARY KEY (resource_rid, capability),
        FOREIGN KEY (resource_rid) REFERENCES resources(rid) ON DELETE CASCADE
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_rc_cap ON resource_capabilities(capability)`);

    await this.run(`
      CREATE TABLE IF NOT EXISTS container_ignore_patterns (
        container_rid  TEXT NOT NULL,
        pattern        TEXT NOT NULL,
        PRIMARY KEY (container_rid, pattern),
        FOREIGN KEY (container_rid) REFERENCES resources(rid) ON DELETE CASCADE
      )
    `);

    // ======================== 关系表 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS relations (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        from_rid  TEXT NOT NULL,
        to_rid    TEXT NOT NULL,
        type      TEXT NOT NULL,
        created   INTEGER NOT NULL,
        metadata  TEXT DEFAULT '{}',
        updated   INTEGER,
        deleted   INTEGER DEFAULT 0,
        UNIQUE(from_rid, to_rid, type)
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_rid)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_rid)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_relations_deleted ON relations(deleted)`);

    // ======================== 同步 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        action    TEXT NOT NULL,
        path      TEXT,
        details   TEXT
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS sync_config (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS sync_ops (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        op_id     TEXT NOT NULL UNIQUE,
        op_type   TEXT NOT NULL,
        rid       TEXT,
        data      TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        applied   INTEGER DEFAULT 1
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_sync_ops_timestamp ON sync_ops(timestamp)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_sync_ops_device ON sync_ops(device_id)`);

    // ======================== 提交 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS commits (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        message   TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        added     INTEGER DEFAULT 0,
        updated   INTEGER DEFAULT 0,
        deleted   INTEGER DEFAULT 0,
        renamed   INTEGER DEFAULT 0,
        metadata  INTEGER DEFAULT 0,
        merge     INTEGER DEFAULT 0
      )
    `);

    // ======================== 暂存区 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS staging_changes (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        type        TEXT NOT NULL CHECK(type IN ('add','modify','delete','rename','metadata')),
        path        TEXT NOT NULL,
        old_path    TEXT,
        rid         TEXT,
        meta_json   TEXT,
        created_at  INTEGER NOT NULL
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_staging_type ON staging_changes(type)`);

    // ======================== 资源来源 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS resource_sources (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_rid  TEXT NOT NULL,
        source_type   TEXT NOT NULL,
        location      TEXT NOT NULL,
        enabled       INTEGER DEFAULT 1,
        sync_mode     TEXT DEFAULT 'manual',
        last_scan_at  INTEGER,
        metadata      TEXT DEFAULT '{}',
        created_at    INTEGER,
        updated_at    INTEGER,
        FOREIGN KEY (resource_rid) REFERENCES resources(rid) ON DELETE CASCADE
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_resource_sources_rid ON resource_sources(resource_rid)`);

    // ======================== 容器成员 ========================
    await this.run('PRAGMA foreign_keys = ON');
    await this.run(`
      CREATE TABLE IF NOT EXISTS container_members (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        container_rid     TEXT NOT NULL,
        source_id         INTEGER,
        resource_rid      TEXT,
        path              TEXT NOT NULL,
        name              TEXT NOT NULL,
        size              INTEGER DEFAULT 0,
        hash              TEXT,
        modified_time     INTEGER,
        status            TEXT DEFAULT 'indexed',
        force_ignore      INTEGER DEFAULT 0,
        source_deleted_at DATETIME,
        created_at        DATETIME DEFAULT (datetime('now')),
        updated_at        DATETIME DEFAULT (datetime('now')),
        metadata          TEXT DEFAULT '{}',
        FOREIGN KEY (container_rid) REFERENCES resources(rid) ON DELETE CASCADE,
        FOREIGN KEY (resource_rid) REFERENCES resources(rid) ON DELETE SET NULL,
        FOREIGN KEY (source_id) REFERENCES resource_sources(id) ON DELETE SET NULL
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_container_members_container ON container_members(container_rid)`);
    await this.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_container_members_path ON container_members(container_rid, source_id, path)`);

    // ======================== 容器同步配置 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS container_sync_configs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        container_rid   TEXT NOT NULL,
        source_id       INTEGER NOT NULL,
        sync_mode       TEXT DEFAULT 'manual',
        delete_policy   TEXT DEFAULT 'soft',
        conflict_policy TEXT DEFAULT 'local',
        interval_ms     INTEGER,
        created_at      DATETIME DEFAULT (datetime('now')),
        updated_at      DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (container_rid) REFERENCES resources(rid) ON DELETE CASCADE,
        FOREIGN KEY (source_id) REFERENCES resource_sources(id) ON DELETE CASCADE
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_sync_configs_container ON container_sync_configs(container_rid)`);
    await this.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_configs_pair ON container_sync_configs(container_rid, source_id)`);

    // ======================== 容器操作 / 事务 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS container_operations (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_id        TEXT UNIQUE NOT NULL,
        container_rid       TEXT NOT NULL,
        type                TEXT NOT NULL,
        member_id           INTEGER,
        member_path         TEXT,
        source_id           INTEGER,
        before              TEXT,
        after               TEXT,
        created             INTEGER NOT NULL,
        status              TEXT DEFAULT 'success',
        parent_operation_id TEXT,
        error               TEXT,
        actor               TEXT,
        transaction_id      TEXT,
        FOREIGN KEY(container_rid) REFERENCES resources(rid) ON DELETE CASCADE,
        FOREIGN KEY(member_id) REFERENCES container_members(id) ON DELETE SET NULL
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_ops_container ON container_operations(container_rid)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_ops_type ON container_operations(type)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_ops_member ON container_operations(member_id)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_ops_parent ON container_operations(parent_operation_id)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_ops_status ON container_operations(status)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_ops_transaction ON container_operations(transaction_id)`);

    await this.run(`
      CREATE TABLE IF NOT EXISTS container_transactions (
        transaction_id  TEXT PRIMARY KEY,
        container_rid   TEXT NOT NULL,
        type            TEXT NOT NULL,
        description     TEXT,
        status          TEXT NOT NULL DEFAULT 'pending',
        created         INTEGER,
        completed       INTEGER,
        error           TEXT,
        FOREIGN KEY(container_rid) REFERENCES resources(rid) ON DELETE CASCADE
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_tx_container ON container_transactions(container_rid)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_tx_status ON container_transactions(status)`);

    // ======================== AI 建议 / 记忆 / 概念 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS ai_suggestions (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL DEFAULT 'relation',
        source_rid  TEXT,
        target_rid  TEXT,
        payload     TEXT DEFAULT '{}',
        confidence  REAL DEFAULT 0,
        reason      TEXT,
        status      TEXT NOT NULL DEFAULT 'pending',
        created     INTEGER,
        updated     INTEGER,
        priority    TEXT DEFAULT 'medium',
        source      TEXT DEFAULT 'ai',
        expires     INTEGER
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_suggestions(status)`);

    await this.run(`
      CREATE TABLE IF NOT EXISTS ai_memory (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        type          TEXT,
        resource_rid  TEXT,
        concept       TEXT,
        value         TEXT,
        confidence    REAL DEFAULT 0.5,
        tags          TEXT,
        created_at    INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS ai_concepts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT UNIQUE,
        meaning     TEXT,
        confidence  REAL DEFAULT 0.5,
        metadata    TEXT,
        relations   TEXT DEFAULT '[]',
        created_at  INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS ai_interactions (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        request   TEXT,
        response  TEXT,
        actions   TEXT,
        created_at INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS ai_learning (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern     TEXT,
        feedback    TEXT,
        adjustment  TEXT,
        created_at  INTEGER
      )
    `);

    // ======================== 知识事件 / 快照 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS knowledge_events (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        type    TEXT NOT NULL,
        rid     TEXT,
        payload TEXT DEFAULT '{}',
        created INTEGER
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_knowledge_events_type ON knowledge_events(type)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_knowledge_events_rid ON knowledge_events(rid)`);

    await this.run(`
      CREATE TABLE IF NOT EXISTS knowledge_snapshots (
        id              TEXT PRIMARY KEY,
        created_at      INTEGER,
        resource_count  INTEGER DEFAULT 0,
        relation_count  INTEGER DEFAULT 0,
        density         REAL DEFAULT 0,
        entropy         REAL DEFAULT 0,
        growth          REAL DEFAULT 0
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_snapshots_created ON knowledge_snapshots(created_at)`);

    // ======================== 分布式 / 同步记录 / 冲突 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS repositories (
        id        TEXT PRIMARY KEY,
        namespace TEXT NOT NULL UNIQUE,
        name      TEXT NOT NULL,
        path      TEXT NOT NULL,
        created   INTEGER
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_repositories_namespace ON repositories(namespace)`);

    await this.run(`
      CREATE TABLE IF NOT EXISTS remote_resources (
        global_id TEXT PRIMARY KEY,
        namespace TEXT,
        metadata  TEXT DEFAULT '{}',
        hash      TEXT,
        updated   INTEGER
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_remote_resources_ns ON remote_resources(namespace)`);

    await this.run(`
      CREATE TABLE IF NOT EXISTS sync_records (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        repository  TEXT NOT NULL,
        type        TEXT NOT NULL,
        status      TEXT DEFAULT 'success',
        changes     INTEGER DEFAULT 0,
        details     TEXT DEFAULT '{}',
        created     INTEGER
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_sync_records_repo ON sync_records(repository)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_sync_records_type ON sync_records(type)`);

    await this.run(`
      CREATE TABLE IF NOT EXISTS conflicts (
        id        TEXT PRIMARY KEY,
        resource  TEXT NOT NULL,
        type      TEXT DEFAULT 'content_conflict',
        status    TEXT DEFAULT 'pending',
        payload   TEXT DEFAULT '{}',
        created   INTEGER
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_conflicts_resource ON conflicts(resource)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status)`);

    // ======================== 插件 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS plugins (
        id            TEXT PRIMARY KEY,
        name          TEXT,
        version       TEXT,
        enabled       INTEGER DEFAULT 1,
        installed_at  INTEGER,
        updated_at    INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS plugin_settings (
        plugin_id TEXT,
        key       TEXT,
        value     TEXT,
        PRIMARY KEY (plugin_id, key)
      )
    `);

    // ======================== 事件 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS events (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL,
        source      TEXT DEFAULT 'system',
        payload     TEXT DEFAULT '{}',
        metadata    TEXT DEFAULT '{}',
        created_at  INTEGER NOT NULL
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at)`);

    // ======================== 工作流 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS workflows (
        id          TEXT PRIMARY KEY,
        name        TEXT,
        definition  TEXT,
        status      TEXT DEFAULT 'active',
        created_at  INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS workflow_executions (
        id          TEXT PRIMARY KEY,
        workflow_id TEXT,
        status      TEXT,
        context     TEXT,
        created_at  INTEGER,
        updated_at  INTEGER
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_wfexec_workflow ON workflow_executions(workflow_id)`);

    // ======================== 权限 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS roles (
        id          TEXT PRIMARY KEY,
        name        TEXT,
        description TEXT DEFAULT ''
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id     TEXT NOT NULL,
        permission  TEXT NOT NULL,
        PRIMARY KEY (role_id, permission),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_rp_role ON role_permissions(role_id)`);

    await this.run(`
      CREATE TABLE IF NOT EXISTS subjects_roles (
        subject_id  TEXT NOT NULL,
        role_id     TEXT NOT NULL,
        PRIMARY KEY (subject_id, role_id)
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS permissions (
        id          TEXT PRIMARY KEY,
        subject_id  TEXT NOT NULL,
        action      TEXT NOT NULL
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS resource_acl (
        resource_id  TEXT NOT NULL,
        subject_id   TEXT NOT NULL,
        permission   TEXT NOT NULL,
        deny         INTEGER DEFAULT 0,
        PRIMARY KEY (resource_id, subject_id, permission)
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS permission_audit (
        id          TEXT PRIMARY KEY,
        subject     TEXT NOT NULL,
        action      TEXT NOT NULL,
        resource    TEXT DEFAULT '',
        allowed     INTEGER DEFAULT 1,
        reason      TEXT DEFAULT '',
        created_at  INTEGER NOT NULL
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_perm_audit_subject ON permission_audit(subject)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_perm_audit_created ON permission_audit(created_at)`);

    // ======================== 安全 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS identities (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL,
        name        TEXT,
        provider    TEXT DEFAULT 'local',
        metadata    TEXT DEFAULT '{}',
        created_at  INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS policies (
        id              TEXT PRIMARY KEY,
        subject         TEXT NOT NULL,
        resource        TEXT NOT NULL,
        effect          TEXT NOT NULL DEFAULT 'allow',
        priority        INTEGER DEFAULT 0,
        condition_JSON  TEXT,
        metadata        TEXT DEFAULT '{}',
        created_at      INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS policy_actions (
        policy_id  TEXT NOT NULL,
        action     TEXT NOT NULL,
        PRIMARY KEY (policy_id, action),
        FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_pa_policy ON policy_actions(policy_id)`);

    await this.run(`
      CREATE TABLE IF NOT EXISTS security_audit (
        id          TEXT PRIMARY KEY,
        actor       TEXT NOT NULL,
        action      TEXT NOT NULL,
        resource    TEXT DEFAULT '',
        result      TEXT DEFAULT '',
        reason      TEXT DEFAULT '',
        metadata    TEXT DEFAULT '{}',
        created_at  INTEGER
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_sec_audit_actor ON security_audit(actor)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_sec_audit_result ON security_audit(result)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_sec_audit_created ON security_audit(created_at)`);

    await this.run(`
      CREATE TABLE IF NOT EXISTS credentials (
        id            TEXT PRIMARY KEY,
        identity_id   TEXT NOT NULL,
        type          TEXT NOT NULL DEFAULT 'api-key',
        token_hash    TEXT,
        expires_at    INTEGER,
        created_at    INTEGER,
        metadata      TEXT DEFAULT '{}'
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_cred_identity ON credentials(identity_id)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_cred_hash ON credentials(token_hash)`);

    // ======================== Agent ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS agents (
        id          TEXT PRIMARY KEY,
        name        TEXT,
        type        TEXT,
        status      TEXT DEFAULT 'created',
        config      TEXT,
        created_at  INTEGER,
        updated_at  INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id          TEXT PRIMARY KEY,
        agent_id    TEXT,
        status      TEXT,
        input       TEXT,
        output      TEXT,
        created_at  INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS agent_memory (
        id          TEXT PRIMARY KEY,
        agent_id    TEXT,
        type        TEXT,
        content     TEXT,
        created_at  INTEGER
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_agmem_agent ON agent_memory(agent_id)`);

    // ======================== 协作 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS agent_messages (
        id          TEXT PRIMARY KEY,
        from_agent  TEXT,
        to_agent    TEXT,
        type        TEXT,
        payload     TEXT,
        created_at  INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS agent_teams (
        id        TEXT PRIMARY KEY,
        name      TEXT,
        strategy  TEXT
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id      TEXT PRIMARY KEY,
        team_id TEXT,
        goal    TEXT,
        status  TEXT,
        result  TEXT
      )
    `);

    // ======================== 共享记忆 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS shared_memory (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id    TEXT UNIQUE NOT NULL,
        scope       TEXT NOT NULL,
        type        TEXT NOT NULL,
        content     TEXT,
        owner       TEXT DEFAULT 'system',
        visibility  TEXT DEFAULT 'all',
        created_at  INTEGER NOT NULL
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_shared_scope_type ON shared_memory(scope, type)`);

    // ======================== 进化 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS evolution_states (
        id          TEXT PRIMARY KEY,
        version     TEXT,
        health      REAL,
        complexity  REAL,
        connectivity REAL,
        maturity    TEXT,
        snapshot    TEXT,
        score       INTEGER,
        created_at  INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS evolution_actions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        type        TEXT,
        strategy    TEXT,
        action      TEXT,
        status      TEXT,
        result      TEXT,
        created_at  INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS evolution_history (
        id            TEXT PRIMARY KEY,
        before_state  TEXT,
        after_state   TEXT,
        action        TEXT,
        improvement   REAL,
        result        TEXT,
        created_at    INTEGER
      )
    `);

    // ======================== 运行时 ========================
    await this.run(`
      CREATE TABLE IF NOT EXISTS runtime_instances (
        id          TEXT PRIMARY KEY,
        type        TEXT,
        state       TEXT,
        updated_at  INTEGER,
        created_at  INTEGER
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS runtime_events (
        id          TEXT PRIMARY KEY,
        runtime_id  TEXT,
        event       TEXT,
        payload     TEXT DEFAULT '{}',
        created_at  INTEGER
      )
    `);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_rte_runtime ON runtime_events(runtime_id)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_rte_created ON runtime_events(created_at)`);

    await this.run(`
      CREATE TABLE IF NOT EXISTS runtime_state (
        key         TEXT PRIMARY KEY,
        value       TEXT,
        updated_at  INTEGER
      )
    `);

    // ======================== 系统种子数据 ========================
    await this.run(
      `INSERT OR IGNORE INTO resources (rid, name, layer, type, path, hash, metadata, encrypted, created, updated)
       VALUES ('__system__', '__system__', 0, 'system', '', '', '{}', 0, ?, ?)`,
      [Date.now(), Date.now()]
    );
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
}

module.exports = Database;
