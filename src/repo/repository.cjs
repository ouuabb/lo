const Database = require('./database.cjs');
const ResourceService = require('./resourceService.cjs');
const RelationService = require('./relationService.cjs');
const QueryEngine = require('./queryEngine.cjs');
const FileWatcher = require('./fileWatcher.cjs');
const StagingArea = require('./staging.cjs');
const glob = require('glob');
const fs = require('fs-extra');
const path = require('path');
const ResourceType = require('../utils/resourceType.cjs');

class Repository {
  constructor(repoPath = process.cwd()) {
    this.repoPath = repoPath;
    this.db = null;
    this.resourceService = null;
    this.relationService = null;
    this.queryEngine = null;
    this.watcher = null;
    this.staging = new StagingArea(repoPath);
  }

  async init() {
    this.db = new Database(this.repoPath);
    await this.db.init();
    
    this.resourceService = new ResourceService(this.db);
    this.relationService = new RelationService(this.db);
    this.queryEngine = new QueryEngine(this.db);
    
    return this;
  }

  async open({ skipAuth = false } = {}) {
    this.db = new Database(this.repoPath);
    await this.db.open();
    
    this.resourceService = new ResourceService(this.db);
    this.relationService = new RelationService(this.db);
    this.queryEngine = new QueryEngine(this.db);
    
    // 门禁：检查 SSH 认证（管理类命令可跳过）
    if (!skipAuth) {
      const authed = await this.ensureAuthenticated();
      if (!authed) {
        await this.db.close();
        process.exit(1);
      }
    }
    
    return this;
  }

  async close() {
    if (this.watcher) {
      this.watcher.stop();
    }
    if (this.db) {
      await this.db.close();
    }
  }

  // ──────────────────────────────────────
  // SSH 认证
  // ──────────────────────────────────────

  /**
   * 确保当前用户已通过 SSH 认证
   * 如果仓库启用了认证且当前会话未验证，则执行挑战-应答认证
   * @returns {Promise<boolean>} 是否通过认证
   */
  async ensureAuthenticated() {
    const SshAuth = require('../utils/sshAuth.cjs');
    const Logger = require('../utils/logger.cjs');

    // 检查是否启用了认证
    const enabled = await this.getConfig('auth.ssh.enabled');
    if (!enabled) {
      return true;
    }

    // 环境变量覆盖（用于 CI/CD 等场景）
    if (process.env.LO_AUTH_SKIP === '1' || process.env.LO_AUTH_SKIP === 'true') {
      return true;
    }

    // 检查会话缓存
    const ttl = await this.getConfig('auth.ssh.sessionTtl', 15);
    if (SshAuth.isSessionValid(this.repoPath, ttl)) {
      return true;
    }

    // 读取所有注册的公钥
    const keysJson = await this.getConfig('auth.ssh.keys');
    if (!keysJson) {
      Logger.error('认证配置已损坏，请重新启用: lo auth add');
      return false;
    }

    let registeredKeys;
    try {
      registeredKeys = JSON.parse(keysJson);
    } catch {
      Logger.error('认证配置已损坏，请重新启用: lo auth add');
      return false;
    }

    if (!Array.isArray(registeredKeys) || registeredKeys.length === 0) {
      Logger.error('未注册任何 SSH 公钥，请执行: lo auth add');
      return false;
    }

    // 多密钥验证：遍历所有注册公钥，任意一把通过即可
    Logger.info('正在验证 SSH 身份...');
    const result = await SshAuth.verifyMulti(registeredKeys);

    if (result.success) {
      const matched = registeredKeys[result.matchedIndex];
      Logger.success(`SSH 认证通过 (${matched.label || matched.fingerprint || '未知密钥'})`);
      SshAuth.setSessionCache(this.repoPath);
      return true;
    } else {
      Logger.error(`SSH 认证失败: ${result.error}`);
      return false;
    }
  }

  async importFile(filePath, type = null) {
    return this.resourceService.importFile(filePath, type);
  }

  async importDirectory(dirPath, type = null) {
    const patterns = ResourceType.getExtensions(type || 'note').map(ext => `${dirPath}/**/*${ext}`);
    
    const files = glob.sync(`{${patterns.join(',')}}`, {
      cwd: this.repoPath,
      ignore: ['**/node_modules/**', '**/.git/**', '**/.repo/**'],
      absolute: true
    });

    const results = [];
    for (const file of files) {
      try {
        const resource = await this.resourceService.importFile(file, type);
        results.push(resource);
      } catch (e) {
        console.warn(`Failed to import ${file}: ${e.message}`);
      }
    }
    
    return results;
  }

  async createResource(type, content, options = {}) {
    const { filename, metadata = {} } = options;
    
    const ext = ResourceType.getExtensions(type)[0] || '.md';
    const name = filename || `${Date.now()}${ext}`;
    const filePath = path.join(this.repoPath, 'resources', name);
    
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content);
    
    return this.resourceService.create({
      type,
      path: filePath,
      metadata
    });
  }

  async getResource(rid) {
    return this.resourceService.getByRid(rid);
  }

  async getResourceByPath(filePath) {
    return this.resourceService.getByPath(filePath);
  }

  async getAllResources(options = {}) {
    return this.resourceService.getAll(options);
  }

  async updateResource(rid, updates) {
    return this.resourceService.update(rid, updates);
  }

  async deleteResource(rid, soft = true) {
    return this.resourceService.delete(rid, soft);
  }

  async moveResource(rid, newPath) {
    return this.resourceService.move(rid, newPath);
  }

  async linkResources(ridA, ridB, type = 'reference') {
    return this.relationService.createBidirectional(ridA, ridB, type);
  }

  async unlinkResources(ridA, ridB, type) {
    return this.relationService.removeBidirectional(ridA, ridB, type);
  }

  async getRelations(rid) {
    return this.relationService.getRelations(rid);
  }

  async query(options = {}) {
    return this.queryEngine.queryResources(options);
  }

  async search(query) {
    return this.queryEngine.search(query);
  }

  async getStats() {
    return this.queryEngine.getStats();
  }

  async getGraph(rid) {
    return this.queryEngine.getGraph(rid);
  }

  async getConfig(key, defaultValue) {
    const row = await this.db.get(
      'SELECT value FROM sync_config WHERE key = ?',
      [key]
    );
    if (row) {
      const value = row.value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      if (!isNaN(value)) return Number(value);
      return value;
    }
    return defaultValue;
  }

  async setConfig(key, value) {
    const strValue = typeof value === 'boolean' ? value.toString() : String(value);
    await this.db.run(
      'INSERT OR REPLACE INTO sync_config (key, value) VALUES (?, ?)',
      [key, strValue]
    );
    return value;
  }

  async getLastSyncTime() {
    return await this.getConfig('lastSyncTime', 0);
  }

  async setLastSyncTime(timestamp) {
    await this.setConfig('lastSyncTime', timestamp);
  }

  async logSync(action, path, details = '') {
    await this.db.run(
      'INSERT INTO sync_log (timestamp, action, path, details) VALUES (?, ?, ?, ?)',
      [Date.now(), action, path, details]
    );
  }

  async sync(options = {}) {
    const { full = false, silent = false } = options;
    
    const result = {
      added: [],
      deleted: [],
      updated: [],
      skipped: [],
      total: 0
    };

    const lastSyncTime = full ? 0 : await this.getLastSyncTime();
    const currentTime = Date.now();

    const files = glob.sync('resources/**/*', {
      cwd: this.repoPath,
      ignore: ['**/node_modules/**', '**/.git/**', '**/.repo/**'],
      absolute: true,
      nodir: true
    });

    for (const file of files) {
      try {
        if (!ResourceType.isSupported(file)) {
          continue;
        }

        const stats = await fs.stat(file);
        const mtime = stats.mtime.getTime();

        if (!full && mtime < lastSyncTime) {
          continue;
        }

        const existing = await this.resourceService.getByPath(file);
        
        if (!existing) {
          const resource = await this.resourceService.importFile(file);
          result.added.push({
            path: file,
            type: resource.type,
            rid: resource.rid
          });
          await this.logSync('added', file, resource.type);
        } else {
          const rehashed = await this.resourceService.rehash(existing.rid);
          if (rehashed.hash !== existing.hash) {
            result.updated.push({
              path: file,
              type: existing.type,
              rid: existing.rid
            });
            await this.logSync('updated', file, 'hash changed');
          }
        }
      } catch (e) {
        result.skipped.push({
          path: file,
          error: e.message
        });
      }
    }

    const dbResources = await this.resourceService.getAll();
    for (const resource of dbResources) {
      try {
        if (!await fs.pathExists(resource.path)) {
          await this.resourceService.delete(resource.rid, true);
          result.deleted.push({
            path: resource.path,
            type: resource.type,
            rid: resource.rid
          });
          await this.logSync('deleted', resource.path, 'file not found');
        }
      } catch (e) {
        result.skipped.push({
          path: resource.path,
          error: e.message
        });
      }
    }

    await this.setLastSyncTime(currentTime);

    result.total = result.added.length + result.deleted.length + result.updated.length;
    
    return result;
  }

  async commit(message, stagingResult) {
    await this.db.run(
      'INSERT INTO commits (message, timestamp, added, deleted, renamed) VALUES (?, ?, ?, ?, ?)',
      [message, Date.now(), stagingResult.added, stagingResult.deleted, stagingResult.renamed]
    );
  }

  async getCommits(limit = 20) {
    return await this.db.all(
      'SELECT * FROM commits ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
  }

  startWatcher(callback) {
    this.watcher = new FileWatcher(this.repoPath, async (event) => {
      try {
        await this._handleFileEvent(event);
        if (callback) {
          callback(event);
        }
      } catch (e) {
        console.error(`Watcher event error: ${e.message}`);
      }
    });
    
    this.watcher.start();
    return this;
  }

  async _syncNewFiles() {
    const resourcesDir = path.join(this.repoPath, 'resources');
    
    if (!await fs.pathExists(resourcesDir)) {
      return { added: 0, deleted: 0, updated: 0, moved: 0 };
    }

    const lastSyncTime = await this.getLastSyncTime();
    const currentTime = Date.now();

    const files = glob.sync('**/*', {
      cwd: resourcesDir,
      ignore: ['**/node_modules/**', '**/.git/**'],
      absolute: true,
      nodir: true
    });

    let addedCount = 0;
    let movedCount = 0;
    for (const file of files) {
      try {
        if (!ResourceType.isSupported(file)) {
          continue;
        }

        const stats = await fs.stat(file);
        const mtime = stats.mtime.getTime();

        if (lastSyncTime > 0 && mtime < lastSyncTime) {
          continue;
        }

        const existingByPath = await this.resourceService.getByPath(file);
        if (existingByPath) {
          continue;
        }

        const existingByHash = await this.resourceService.getByHash(file);
        if (existingByHash) {
          await this.resourceService.update(existingByHash.rid, { path: file });
          movedCount++;
        } else {
          await this.resourceService.importFile(file);
          addedCount++;
        }
      } catch (e) {
        console.warn(`Failed to sync ${file}: ${e.message}`);
      }
    }

    if (addedCount > 0 || movedCount > 0) {
      await this.setLastSyncTime(currentTime);
    }
    
    return { added: addedCount, deleted: 0, updated: 0, moved: movedCount };
  }

  async _handleFileEvent(event) {
    const { event: eventType, path: filePath } = event;
    
    switch (eventType) {
      case 'add':
        if (ResourceType.isSupported(filePath)) {
          await this.resourceService.importFile(filePath);
        }
        break;
        
      case 'change':
        const resource = await this.resourceService.getByPath(filePath);
        if (resource) {
          await this.resourceService.rehash(resource.rid);
        }
        break;
        
      case 'delete':
        const deletedResource = await this.resourceService.getByPath(filePath);
        if (deletedResource) {
          await this.resourceService.delete(deletedResource.rid, true);
        }
        break;
    }
  }

  static async create(repoPath) {
    await fs.ensureDir(repoPath);
    await fs.ensureDir(path.join(repoPath, 'resources'));
    
    const repo = new Repository(repoPath);
    await repo.init();
    
    return repo;
  }
}

module.exports = Repository;