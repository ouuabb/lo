const Database = require('./database.cjs');
const ResourceService = require('./resourceService.cjs');
const RelationService = require('./relationService.cjs');
const QueryEngine = require('./queryEngine.cjs');
const FileWatcher = require('./fileWatcher.cjs');
const StagingArea = require('./staging.cjs');
const SyncOpsEngine = require('./syncOps.cjs');
const ContainerService = require('./containerService.cjs');
const SourceService = require('./sourceService.cjs');
const glob = require('glob');
const fs = require('fs-extra');
const path = require('path');
const ResourceType = require('../utils/resourceType.cjs');
const WikiLinkParser = require('../utils/wikilinkParser.cjs');

class Repository {
  constructor(repoPath = process.cwd()) {
    this.repoPath = repoPath;
    this.db = null;
    this.resourceService = null;
    this.relationService = null;
    this.queryEngine = null;
    this.watcher = null;
    this.staging = new StagingArea(repoPath);
    this.syncOps = null;
    this.containerService = null;
    this.sourceService = null;
    /** @type {Buffer|null} 解密后的仓库加密密钥（仅存在于内存中） */
    this._cryptoKey = null;
  }

  async init() {
    this.db = new Database(this.repoPath);
    await this.db.init();
    
    this.resourceService = new ResourceService(this.db, {
      getCryptoKey: () => this._cryptoKey
    });
    this.relationService = new RelationService(this.db);
    this.queryEngine = new QueryEngine(this.db);
    this.syncOps = new SyncOpsEngine(this.db, this.repoPath);
    this.containerService = new ContainerService(this.db, this.resourceService, {
      getCryptoKey: () => this._cryptoKey
    });
    this.sourceService = new SourceService(this.db);
    
    return this;
  }

  async open({ skipAuth = false } = {}) {
    this.db = new Database(this.repoPath);
    await this.db.open();
    // 确保全部表存在（为已有仓库做增量迁移）
    await this.db.createTables();
    
    this.resourceService = new ResourceService(this.db, {
      getCryptoKey: () => this._cryptoKey
    });
    this.relationService = new RelationService(this.db);
    this.queryEngine = new QueryEngine(this.db);
    this.syncOps = new SyncOpsEngine(this.db, this.repoPath);
    this.containerService = new ContainerService(this.db, this.resourceService, {
      getCryptoKey: () => this._cryptoKey
    });
    this.sourceService = new SourceService(this.db);
    
    // 门禁：检查 SSH 认证（管理类命令可跳过）
    if (!skipAuth) {
      const authed = await this.ensureAuthenticated();
      if (!authed) {
        await this.db.close();
        process.exit(1);
      }
    }

    // 加载加密密钥到内存
    await this._loadCryptoKey({ skipAuth });
    
    return this;
  }

  /**
   * 获取当前会话的加密密钥（返回副本，仅内存中存在）
   * 调用方获得的是独立副本，close() 时安全擦除不影响外部引用
   * @returns {Buffer|null}
   */
  get cryptoKey() {
    return this._cryptoKey ? Buffer.from(this._cryptoKey) : null;
  }

  async close() {
    if (this.watcher) {
      this.watcher.stop();
    }
    if (this.db) {
      await this.db.close();
    }
    // 安全清除内存中的加密密钥，防止冷启动攻击和内存 dump 泄漏
    if (this._cryptoKey) {
      this._cryptoKey.fill(0);
      this._cryptoKey = null;
    }
  }

  // ──────────────────────────────────────
  // 加密密钥管理
  // ──────────────────────────────────────

  /**
   * 加载仓库加密密钥到内存
   *
   * 流程:
   *   1. 检查仓库是否启用了加密 (isEncryptionEnabled)
   *   2. 优先尝试从受保护的 SSH 密钥副本解密
   *   3. 降级: 从明文副本直接加载 (未配置 SSH 保护的场景)
   *
   * @param {{ skipAuth?: boolean }} options
   */
  async _loadCryptoKey(options = {}) {
    const CryptoUtils = require('../utils/crypto.cjs');
    const SshAuth = require('../utils/sshAuth.cjs');

    if (!CryptoUtils.isEncryptionEnabled(this.repoPath)) {
      return; // 仓库未启用加密
    }

    // 尝试从受保护的密钥副本解密（需要 SSH 密钥）
    const keysJson = await this.getConfig('auth.ssh.keys');
    if (keysJson) {
      try {
        const registeredKeys = JSON.parse(keysJson);
        const localKeys = SshAuth.listKeys();

        for (const regKey of registeredKeys) {
          if (!regKey.fingerprint) continue;

          const localMatch = localKeys.find(k => k.fingerprint === regKey.fingerprint);
          if (!localMatch) continue;

          const result = CryptoUtils.unlockRepoKey(
            this.repoPath,
            localMatch.publicKeyPath,
            regKey.fingerprint
          );

          if (result.success) {
            this._cryptoKey = result.repoKey;
            return;
          }
        }
      } catch {
        // 解析失败，尝试降级方案
      }
    }

    // 降级: 直接加载明文 RepoKey（适用于未配置 SSH 保护的场景）
    // 仅在 SSH 保护密钥不存在或无法匹配时才降级
    const repoKey = CryptoUtils.loadRepoKey(this.repoPath);
    if (repoKey) {
      const Logger = require('../utils/logger.cjs');
      Logger.warn('正在使用未受保护的加密密钥（明文 repo.key 存在）');
      Logger.warn('建议运行 lo auth add 使用 SSH 密钥保护仓库密钥');
      this._cryptoKey = repoKey;
    }
  }

  /**
   * 使用 SSH 密钥保护仓库加密密钥
   * @param {string} pubKeyPath - SSH 公钥路径
   * @param {string} fingerprint - 密钥指纹
   * @param {string} label - 密钥标签
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async protectCryptoKey(pubKeyPath, fingerprint, label) {
    const CryptoUtils = require('../utils/crypto.cjs');
    return CryptoUtils.protectRepoKeyWithSshKey(this.repoPath, pubKeyPath, fingerprint, label);
  }

  /**
   * 移除受保护的加密密钥副本
   * @param {string} fingerprint
   */
  async removeProtectedCryptoKey(fingerprint) {
    const CryptoUtils = require('../utils/crypto.cjs');
    return CryptoUtils.removeProtectedKey(this.repoPath, fingerprint, this._cryptoKey);
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
    const resource = await this.resourceService.importFile(filePath, type);

    // 记录操作日志
    if (this.syncOps && resource) {
      const relPath = path.relative(this.repoPath, resource.path);
      await this.syncOps.recordOp(SyncOpsEngine.OP_TYPES.RESOURCE_CREATED, resource.rid, {
        name: resource.name,
        layer: resource.layer || 0,
        type: resource.type,
        path: relPath,
        hash: resource.hash,
        metadata: resource.metadata,
        encrypted: resource.encrypted,
        created: resource.created,
        updated: resource.updated
      });
    }

    // 如果是 .md 文件，自动解析并同步 [[...]] wikilink
    if (resource && resource.path.toLowerCase().endsWith('.md')) {
      try { await this.syncWikilinks(resource.rid); } catch (e) {}
    }
    return resource;
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
        const resource = await this.importFile(file, type);
        results.push(resource);
      } catch (e) {
        console.warn(`Failed to import ${file}: ${e.message}`);
      }
    }
    
    return results;
  }

  async createResource(type, content, options = {}) {
    const { filename, metadata = {} } = options;
    const CryptoUtils = require('../utils/crypto.cjs');
    
    const ext = ResourceType.getExtensions(type)[0] || '.md';
    const name = filename || `${Date.now()}${ext}`;
    const filePath = path.join(this.repoPath, 'resources', name);
    
    await fs.ensureDir(path.dirname(filePath));

    // 使用 ResourceService 的统一写入方法（自动处理加密）
    const contentBuf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
    if (this._cryptoKey) {
      await CryptoUtils.writeEncryptedFile(filePath, contentBuf, this._cryptoKey);
    } else {
      await fs.writeFile(filePath, contentBuf);
    }
    
    const result = await this.resourceService.create({
      type,
      path: filePath,
      metadata
    });

    // 记录操作日志
    if (this.syncOps) {
      const relPath = path.relative(this.repoPath, filePath);
      await this.syncOps.recordOp(SyncOpsEngine.OP_TYPES.RESOURCE_CREATED, result.rid, {
        name: result.name,
        layer: result.layer || 0,
        type,
        path: relPath,
        hash: result.hash,
        metadata: result.metadata,
        encrypted: result.encrypted,
        created: result.created,
        updated: result.updated
      });
    }
    
    return result;
  }

  /**
   * 创建具有 Container Capability 的资源
   *
   * 对应 `lo create resource project ./demo`:
   *   - type: 资源类型 (project, album, dataset, collection 等)
   *   - path: 内容来源目录
   *   - capabilities: 自动根据 type 加载对应 capability（如 project → ["container"]）
   *   - container_schema: 自动根据 type 加载容器规则
   *
   * @param {string} type - 资源类型
   * @param {string} contentPath - 内容来源路径（目录或文件）
   * @param {{ name?: string, capabilities?: string[], container_schema?: object, metadata?: object, scanMembers?: boolean }} options
   * @returns {Promise<object>} 创建的 Resource
   */
  async createResourceWithContainer(type, contentPath, options = {}) {
    const absPath = path.resolve(this.repoPath, contentPath);
    const { name: customName, capabilities, container_schema, metadata = {},
            scanMembers = true } = options;

    // 根据 type 推导默认 capabilities 和 container_schema
    const defaults = this._getContainerDefaults(type);
    const finalCapabilities = capabilities || defaults.capabilities;
    const finalSchema = container_schema || defaults.container_schema;

    const resourceName = customName || path.basename(absPath);

    // 创建 Resource（没有实际内容文件时使用目录路径作为占位）
    const exists = await fs.pathExists(absPath);
    if (!exists) {
      throw new Error(`路径不存在: ${absPath}`);
    }

    const resource = await this.resourceService.create({
      type,
      path: absPath,
      name: resourceName,
      metadata: { ...metadata, title: resourceName },
      capabilities: finalCapabilities,
      container_schema: finalSchema
    });

    // 绑定 Content Source
    const isDir = (await fs.stat(absPath)).isDirectory();
    if (isDir) {
      await this.sourceService.addLocalFolderSource(resource.rid, absPath);
    } else {
      await this.sourceService.addSource(resource.rid, 'local_file', absPath);
    }

    // 如果具有 container 能力且是目录，扫描成员
    if (finalCapabilities.includes('container') && isDir && scanMembers) {
      await this.containerService.scanSource(resource.rid, absPath);
    }

    // 记录操作日志
    if (this.syncOps) {
      await this.syncOps.recordOp(SyncOpsEngine.OP_TYPES.RESOURCE_CREATED, resource.rid, {
        name: resource.name,
        layer: resource.layer || 0,
        type: resource.type,
        path: path.relative(this.repoPath, absPath),
        hash: resource.hash,
        metadata: resource.metadata,
        capabilities: resource.capabilities,
        container_schema: resource.container_schema,
        encrypted: resource.encrypted,
        created: resource.created,
        updated: resource.updated
      });
    }

    return resource;
  }

  /**
   * 根据资源类型获取默认的 capabilities 和 container_schema
   */
  _getContainerDefaults(type) {
    const defaults = {
      project: {
        capabilities: ['container'],
        container_schema: {
          allowed_types: ['note', 'document', 'image', 'code', 'json', 'yaml', 'xml', 'csv', 'text']
        }
      },
      album: {
        capabilities: ['container'],
        container_schema: {
          allowed_types: ['image', 'video']
        }
      },
      dataset: {
        capabilities: ['container'],
        container_schema: {
          allowed_types: ['csv', 'json', 'yaml', 'xml']
        }
      },
      course: {
        capabilities: ['container'],
        container_schema: {
          allowed_types: ['note', 'video', 'audio', 'document', 'image', 'pdf']
        }
      },
      collection: {
        capabilities: ['container'],
        container_schema: {
          allowed_types: []  // 不限制
        }
      }
    };

    return defaults[type] || { capabilities: [], container_schema: {} };
  }

  /**
   * 绑定 Content Source 到 Resource
   * @param {string} resourceRid
   * @param {string} sourceType - local_folder / git_repository 等
   * @param {string} location
   * @param {object} [metadata]
   */
  async bindSource(resourceRid, sourceType, location, metadata = {}) {
    return this.sourceService.addSource(resourceRid, sourceType, location, metadata);
  }

  /**
   * 获取 Resource 的 Content Source
   * @param {string} resourceRid
   */
  async getResourceSources(resourceRid) {
    return this.sourceService.getSources(resourceRid);
  }

  /**
   * 扫描容器内容源，刷新成员列表
   * @param {string} containerRid
   */
  async scanContainerMembers(containerRid) {
    if (!await this.containerService.hasContainerCapability(containerRid)) {
      throw new Error(`Resource ${containerRid} 不具有 Container Capability`);
    }
    const sources = await this.sourceService.getLocalFolderSources(containerRid);
    const results = [];
    for (const src of sources) {
      const scanResult = await this.containerService.scanSource(containerRid, src.location);
      results.push({ source: src.location, ...scanResult });
    }
    return results;
  }

  /**
   * 获取容器成员列表
   * @param {string} containerRid
   * @param {{ resourceOnly?: boolean, fileOnly?: boolean }} options
   */
  async getContainerMembers(containerRid, options = {}) {
    return this.containerService.getMembers(containerRid, options);
  }

  /**
   * Promote: 将容器中的文件成员提升为独立 Resource
   *
   * 提升后的文件:
   *   - 拥有独立 RID
   *   - 可以参与 Relation
   *   - 仍然是容器的成员（resource_rid 指向新 Resource）
   *
   * @param {string} containerRid - 容器 RID
   * @param {string} memberPath - 成员在容器中的路径
   * @param {{ type?: string, metadata?: object }} options
   * @returns {Promise<object>} 新创建的 Resource
   */
  async promoteMember(containerRid, memberPath, options = {}) {
    const resource = await this.containerService.promoteMember(containerRid, memberPath, options);

    // 记录操作日志
    if (this.syncOps) {
      await this.syncOps.recordOp('member_promoted', resource.rid, {
        container_rid: containerRid,
        member_path: memberPath,
        name: resource.name,
        type: resource.type,
        hash: resource.hash,
        metadata: resource.metadata
      });
    }

    return resource;
  }

  /**
   * 获取容器成员统计
   * @param {string} containerRid
   */
  async getContainerMemberStats(containerRid) {
    return this.containerService.getMemberStats(containerRid);
  }

  async getResource(rid) {
    return this.resourceService.getByRid(rid);
  }

  /**
   * 统一资源解析：rid > name > path 三级查找
   * rid 是一等公民，优先按 rid 查；其次按 name（逻辑名称）；最后按 path 降级
   * @param {string} input - 用户输入（可能是 rid、名称或路径）
   * @returns {Promise<object|null>}
   */
  async resolveResource(input) {
    // 1. 按 rid 精确匹配
    if (input.startsWith('res_')) {
      return this.resourceService.getByRid(input);
    }

    // 2. 按 name 精确匹配（全局唯一）
    const byName = await this.resourceService.getByName(input);
    if (byName) return byName;

    // 3. 按路径降级匹配
    const byPath = await this.resourceService.getByPath(input);
    if (byPath) return byPath;

    const absPath = path.join(this.repoPath, 'resources', input);
    if (absPath !== input) {
      const byAbs = await this.resourceService.getByPath(absPath);
      if (byAbs) return byAbs;
    }

    return null;
  }

  async getResourceByName(name) {
    return this.resourceService.getByName(name);
  }

  async getResourceByPath(filePath) {
    return this.resourceService.getByPath(filePath);
  }

  async getAllResources(options = {}) {
    return this.resourceService.getAll(options);
  }

  async updateResource(rid, updates) {
    const oldResource = await this.resourceService.getByRid(rid);
    const result = await this.resourceService.update(rid, updates);
    
    // 记录操作日志
    if (this.syncOps && oldResource) {
      await this.syncOps.recordOp(SyncOpsEngine.OP_TYPES.RESOURCE_UPDATED, rid, {
        path: path.relative(this.repoPath, oldResource.path),
        old_hash: oldResource.hash,
        new_hash: result.hash,
        metadata: result.metadata
      });
    }
    
    return result;
  }

  async deleteResource(rid, soft = true) {
    const resource = await this.resourceService.getByRid(rid);
    const result = await this.resourceService.delete(rid, soft);
    
    // 记录操作日志
    if (this.syncOps && resource) {
      await this.syncOps.recordOp(SyncOpsEngine.OP_TYPES.RESOURCE_DELETED, rid, {
        path: path.relative(this.repoPath, resource.path),
        type: resource.type,
        hash: resource.hash
      });
    }
    
    return result;
  }

  async moveResource(rid, newPath) {
    const oldResource = await this.resourceService.getByRid(rid);
    const result = await this.resourceService.move(rid, newPath);
    
    // 记录操作日志
    if (this.syncOps && oldResource) {
      await this.syncOps.recordOp(SyncOpsEngine.OP_TYPES.RESOURCE_MOVED, rid, {
        old_path: path.relative(this.repoPath, oldResource.path),
        new_path: path.relative(this.repoPath, newPath)
      });
    }
    
    return result;
  }

  async linkResources(ridA, ridB, type = 'reference') {
    if (type === 'wikilink') {
      return this.relationService.create(ridA, ridB, type);
    }
    return this.relationService.createBidirectional(ridA, ridB, type);
  }

  async unlinkResources(ridA, ridB, type) {
    if (type === 'wikilink') {
      return this.relationService.remove(ridA, ridB, type);
    }
    return this.relationService.removeBidirectional(ridA, ridB, type);
  }

  /**
   * 同步指定资源的 wikilink 关系
   * 读取 .md 文件内容，解析 [[...]] 语法，更新 relations 表
   * @param {string} rid
   * @returns {{wikilinks: number, error?: string}}
   */
  async syncWikilinks(rid) {
    const resource = await this.resourceService.getByRid(rid);
    if (!resource) return { wikilinks: 0, error: 'Resource not found' };
    if (resource.type !== 'note') return { wikilinks: 0 };
    if (!resource.path.toLowerCase().endsWith('.md')) return { wikilinks: 0 };

    try {
      // 读取文件内容（自动处理加密/明文）
      const content = await this.resourceService._readFile(resource.path, 'utf-8');

      // 解析 [[...]] 引用
      const targets = WikiLinkParser.parseTargets(content);

      // 删除该资源所有旧的 wikilink 关系
      const oldLinks = await this.relationService.getByFromRid(rid);
      for (const old of oldLinks) {
        if (old.type === 'wikilink') {
          await this.relationService.remove(rid, old.to_rid, 'wikilink');
        }
      }

      // 为每个 target 解析 RID 并创建新 wikilink
      for (const target of targets) {
        const targetRid = await this._resolveWikiLinkTarget(target);
        if (targetRid && targetRid !== rid) {
          try {
            await this.relationService.create(rid, targetRid, 'wikilink');
          } catch (e) {
            // 重复关系静默跳过
          }
        }
      }

      return { wikilinks: targets.length >= 0 ? targets.length : 0 };
    } catch (e) {
      return { wikilinks: 0, error: e.message };
    }
  }

  /**
   * 将 wikilink target 名称解析为 RID
   * 1. 按 RID 直接匹配 (res_xxx 格式，唯一且精确)
   * 2. 按 metadata.title 匹配
   * 3. 按文件路径匹配 (resources/Target.md 或 *-Target.md)
   * @param {string} target
   * @returns {Promise<string|null>}
   */
  async _resolveWikiLinkTarget(target) {
    // 1. 按 RID 直接匹配（res_ 前缀，唯一标识符）
    if (target.startsWith('res_')) {
      const resource = await this.resourceService.getByRid(target);
      if (resource) return resource.rid;
      return null;
    }

    // 2. 按 name 精确匹配（全局唯一逻辑名称）
    const byName = await this.resourceService.getByName(target);
    if (byName) return byName.rid;

    // 3. 按标题匹配
    const all = await this.resourceService.getAll();
    for (const r of all) {
      if (r.metadata && r.metadata.title === target) {
        return r.rid;
      }
    }

    // 4. 按文件路径匹配
    const resourcesDir = path.join(this.repoPath, 'resources');
    let dirEntries = [];
    try {
      dirEntries = await fs.readdir(resourcesDir);
    } catch (e) {
      return null;
    }

    for (const entry of dirEntries) {
      const fullPath = path.join(resourcesDir, entry);
      // resources/Target.md 或 resources/YYYY-MM-DD-Target-xxxxxxxx.md
      if (entry === target + '.md' || entry.endsWith('-' + target + '.md')) {
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isFile()) {
            const r = await this.resourceService.getByPath(fullPath);
            if (r) return r.rid;
          }
        } catch (e) {
          // 跳过
        }
      }
    }

    return null;
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
    const { full = false, silent = false, wikilinks = false } = options;
    
    const result = {
      added: [],
      deleted: [],
      updated: [],
      renamed: [],
      skipped: [],
      total: 0,
      wikilinks: 0
    };

    const lastSyncTime = full ? 0 : await this.getLastSyncTime();
    const currentTime = Date.now();

    const files = glob.sync('**/*', {
      cwd: this.repoPath,
      ignore: ['**/node_modules/**', '**/.git/**', '**/.repo/**'],
      absolute: true,
      nodir: true
    });

    const dbResources = await this.resourceService.getAll();
    const dbByPath = new Map(dbResources.map(r => [r.path, r]));

    // 第一阶段：处理路径匹配的文件（刷新已存在的），收集"疑似新增"文件
    const newFileCandidates = [];
    const wikilinkSyncRids = new Set();

    for (const file of files) {
      try {
        if (!ResourceType.isSupported(file)) {
          continue;
        }

        const existing = dbByPath.get(file);

        if (!existing) {
          // 新文件（可能来自重命名），始终处理，不依赖 mtime（rename 会保留原始 mtime）
          newFileCandidates.push(file);
        } else {
          // 已存在的文件：用 mtime 做增量过滤
          if (!full) {
            const stats = await fs.stat(file);
            if (stats.mtime.getTime() < lastSyncTime) {
              continue;
            }
          }
          const refreshed = await this.resourceService.refresh(existing.rid);
          if (refreshed.hash !== existing.hash ||
              JSON.stringify(refreshed.metadata) !== JSON.stringify(existing.metadata)) {
            result.updated.push({
              path: file,
              type: existing.type,
              rid: existing.rid
            });
            // md 文件内容变更后需要同步 wikilink
            if (file.toLowerCase().endsWith('.md')) {
              wikilinkSyncRids.add(existing.rid);
            }
            await this.logSync('updated', file, 'hash or metadata changed');

            if (this.syncOps) {
              const relPath = path.relative(this.repoPath, file);
              await this.syncOps.recordOp(SyncOpsEngine.OP_TYPES.RESOURCE_UPDATED, existing.rid, {
                path: relPath,
                old_hash: existing.hash,
                new_hash: refreshed.hash,
                metadata: refreshed.metadata
              });
            }
          }
        }
      } catch (e) {
        result.skipped.push({
          path: file,
          error: e.message
        });
      }
    }

    // 收集"疑似删除"的 DB 记录（路径在磁盘上不存在）
    const deletedCandidates = [];
    for (const resource of dbResources) {
      if (!await fs.pathExists(resource.path)) {
        deletedCandidates.push(resource);
      }
    }

    // 第二阶段：匹配"疑似删除"和"疑似新增"的 hash，检测重命名
    const HashUtils = require('../utils/hash.cjs');
    const newFileHashes = new Map();
    for (const file of newFileCandidates) {
      try {
        newFileHashes.set(file, await HashUtils.fromFile(file, this._cryptoKey));
      } catch (e) {
        result.skipped.push({ path: file, error: e.message });
      }
    }

    const matchedNewPaths = new Set();
    for (const deletedResource of deletedCandidates) {
      let matched = false;
      for (const [newFile, newHash] of newFileHashes) {
        if (matchedNewPaths.has(newFile)) continue;
        if (newHash === deletedResource.hash) {
          // 重命名：更新路径，RID 不变
          await this.resourceService.updatePath(deletedResource.rid, newFile);
          result.renamed.push({
            oldPath: deletedResource.path,
            newPath: newFile,
            rid: deletedResource.rid
          });
          await this.logSync('renamed', `${deletedResource.path} -> ${newFile}`, 'hash matched');

          if (this.syncOps) {
            const oldRel = path.relative(this.repoPath, deletedResource.path);
            const newRel = path.relative(this.repoPath, newFile);
            await this.syncOps.recordOp(SyncOpsEngine.OP_TYPES.RESOURCE_MOVED, deletedResource.rid, {
              old_path: oldRel,
              new_path: newRel
            });
          }
          matchedNewPaths.add(newFile);
          matched = true;
          break;
        }
      }

      if (!matched) {
        // 真正的删除
        await this.resourceService.delete(deletedResource.rid, true);
        result.deleted.push({
          path: deletedResource.path,
          type: deletedResource.type,
          rid: deletedResource.rid
        });
        await this.logSync('deleted', deletedResource.path, 'file not found');

        if (this.syncOps) {
          const relPath = path.relative(this.repoPath, deletedResource.path);
          await this.syncOps.recordOp(SyncOpsEngine.OP_TYPES.RESOURCE_DELETED, deletedResource.rid, {
            path: relPath,
            type: deletedResource.type,
            hash: deletedResource.hash
          });
        }
      }
    }

    // 未被匹配的新文件 → 真正的新增
    for (const [newFile, newHash] of newFileHashes) {
      if (matchedNewPaths.has(newFile)) continue;
      try {
        const resource = await this.importFile(newFile);
        result.added.push({
          path: newFile,
          type: resource.type,
          rid: resource.rid
        });
        // .md 文件的 wikilink 已在 importFile 中同步，此处跟踪计数
        if (newFile.toLowerCase().endsWith('.md')) {
          wikilinkSyncRids.add(resource.rid);
        }
        await this.logSync('added', newFile, resource.type);

        if (this.syncOps) {
          const relPath = path.relative(this.repoPath, newFile);
          await this.syncOps.recordOp(SyncOpsEngine.OP_TYPES.RESOURCE_CREATED, resource.rid, {
            name: resource.name,
            layer: resource.layer || 0,
            type: resource.type,
            path: relPath,
            hash: resource.hash,
            metadata: resource.metadata,
            encrypted: resource.encrypted,
            created: resource.created,
            updated: resource.updated
          });
        }
      } catch (e) {
        result.skipped.push({ path: newFile, error: e.message });
      }
    }

    await this.setLastSyncTime(currentTime);

    // 同步 wikilink 关系
    if (wikilinks) {
      // 全量扫描：所有 .md 文件
      const allResources = await this.resourceService.getAll();
      for (const r of allResources) {
        if (r.path && r.path.toLowerCase().endsWith('.md')) {
          const syncResult = await this.syncWikilinks(r.rid);
          if (!syncResult.error) {
            result.wikilinks += syncResult.wikilinks;
          }
        }
      }
    } else {
      // 增量：只同步变更过的 .md 文件
      for (const rid of wikilinkSyncRids) {
        const syncResult = await this.syncWikilinks(rid);
        if (!syncResult.error) {
          result.wikilinks += syncResult.wikilinks;
        }
      }
    }

    result.total = result.added.length + result.deleted.length + result.updated.length + result.renamed.length;
    
    return result;
  }

  async commit(message, stagingResult, isMerge = false) {
    await this.db.run(
      'INSERT INTO commits (message, timestamp, added, updated, deleted, renamed, metadata, merge) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [message, Date.now(), stagingResult.added, stagingResult.updated || 0, stagingResult.deleted, stagingResult.renamed, stagingResult.metadata || 0, isMerge ? 1 : 0]
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
          await this.importFile(file);
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
          await this.importFile(filePath);
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