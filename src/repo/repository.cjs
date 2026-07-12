const Database = require('./database.cjs');
const ResourceService = require('./resourceService.cjs');
const RelationService = require('./relationService.cjs');
const QueryEngine = require('./queryEngine.cjs');
const FileWatcher = require('./fileWatcher.cjs');
const StagingArea = require('./staging.cjs');
const SyncOpsEngine = require('./syncOps.cjs');
const ContainerService = require('./containerService.cjs');
const SourceService = require('./sourceService.cjs');
const ContainerSyncEngine = require('./containerSyncEngine.cjs');
const SyncConfigService = require('./syncConfigService.cjs');
const OperationRegistry = require('./operationRegistry.cjs');
const OperationEngine = require('./operationEngine.cjs');
const TransactionEngine = require('./transactionEngine.cjs');
const GraphBuilder = require('./graphBuilder.cjs');
const GraphEngine = require('./graphEngine.cjs');
const GraphExporter = require('./graphExporter.cjs');
const GraphCache = require('./graphCache.cjs');
const GraphQueryBuilder = require('../domain/graphQuery.cjs');
const NavigationEngine = require('./navigationEngine.cjs');
const VisualizationEngine = require('./visualizationEngine.cjs');
const VisualExporter = require('./visualExporter.cjs');
const KnowledgeAnalyzer = require('./knowledgeAnalyzer.cjs');
const KnowledgeTimeline = require('./knowledgeTimeline.cjs');
const RecommendationEngine = require('./recommendationEngine.cjs');
const AIContextBuilder = require('./aiContextBuilder.cjs');
const SemanticRelationEngine = require('./semanticRelationEngine.cjs');
const SuggestionEngine = require('./suggestionEngine.cjs');
const AIMemory = require('./aiMemory.cjs');
const KnowledgeAssistant = require('./knowledgeAssistant.cjs');
const KnowledgeRepair = require('./knowledgeRepair.cjs');
const KnowledgeScheduler = require('./knowledgeScheduler.cjs');
const ResourceLifecycle = require('../domain/resourceLifecycle.cjs');
const ResourceWatcher = require('./resourceWatcher.cjs');
const FederationManager = require('./federationManager.cjs');
const FederatedGraphEngine = require('./federatedGraphEngine.cjs');
const SyncEngine = require('./syncEngine.cjs');
const GlobalRID = require('../domain/globalResourceId.cjs');
const KnowledgeEvolutionEngine = require('./knowledgeEvolutionEngine.cjs');
const KnowledgePatternEngine = require('./knowledgePatternEngine.cjs');
const KnowledgeStrategyEngine = require('./knowledgeStrategyEngine.cjs');
const CollectiveKnowledgeEngine = require('./collectiveKnowledgeEngine.cjs');
const EvolutionMemory = require('./evolutionMemory.cjs');
const PluginManager = require('../plugin/pluginManager.cjs');
const Event = require('../event/event.cjs');
const EventBus = require('../event/eventBus.cjs');
const EventStore = require('../event/eventStore.cjs');
const EventMiddleware = require('../event/eventMiddleware.cjs');
const Workflow = require('../workflow/workflow.cjs');
const WorkflowRegistry = require('../workflow/workflowRegistry.cjs');
const WorkflowEngine = require('../workflow/workflowEngine.cjs');
const StepExecutor = require('../workflow/stepExecutor.cjs');
const ConditionEngine = require('../workflow/conditionEngine.cjs');
const WorkflowScheduler = require('../workflow/workflowScheduler.cjs');
const PermissionManager = require('../security/permissionManager.cjs');
const PolicyEngine = require('../security/policyEngine.cjs');
const PermissionAudit = require('../security/permissionAudit.cjs');
const Agent = require('../agent/agent.cjs');
const AgentRegistry = require('../agent/agentRegistry.cjs');
const AgentEngine = require('../agent/agentEngine.cjs');
const AgentStore = require('../agent/agentStore.cjs');
const AgentScheduler = require('../agent/agentScheduler.cjs');
const TeamRegistry = require('../collaboration/teamRegistry.cjs');
const CollaborationEngine = require('../collaboration/collaborationEngine.cjs');
const CollaborationMemory = require('../collaboration/collaborationMemory.cjs');
const SharedMemory = require('../collaboration/sharedMemory.cjs');
const MessageBus = require('../collaboration/messageBus.cjs');
const AIOS = require('../ai/aiOS.cjs');
const EvolutionEngine = require('../evolution/evolutionEngine.cjs');
const { loadOperations } = require('../operations/index.cjs');
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
    this.operationLogger = null;
    this.operationRegistry = null;
    this.operationEngine = null;
    this.transactionEngine = null;
    this._graphCache = null;
    this.containerService = null;
    this.sourceService = null;
    this.syncEngine = null;
    this.syncConfigService = null;
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
    this._graphCache = new GraphCache();
    this.syncOps = new SyncOpsEngine(this.db, this.repoPath);
    this.containerService = new ContainerService(this.db, this.resourceService, {
      getCryptoKey: () => this._cryptoKey
    });
    this._initOperationEngine();
    this.sourceService = new SourceService(this.db);
    this.syncEngine = new ContainerSyncEngine(this.db, this.containerService, this.sourceService, {
      getCryptoKey: () => this._cryptoKey
    });
    this.syncConfigService = new SyncConfigService(this.db);
    
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
    this._initOperationEngine();
    this.sourceService = new SourceService(this.db);
    this.syncEngine = new ContainerSyncEngine(this.db, this.containerService, this.sourceService, {
      getCryptoKey: () => this._cryptoKey
    });
    this.syncConfigService = new SyncConfigService(this.db);
    
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
      await this.syncEngine.scan(resource.rid);
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
    const { results } = await this.syncEngine.scan(containerRid);
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
   * @param {{ sourceId?: number, type?: string, metadata?: object }} options
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
   * Demote: 将已提升的容器成员降级为普通文件成员
   *
   * 降级后的成员:
   *   - resource_rid 被清除（设为 NULL）
   *   - 不再关联独立 Resource
   *   - Resource 本身不受影响（仍独立存在）
   *
   * @param {string} containerRid - 容器 RID
   * @param {string} memberPath - 成员在容器中的路径
   * @returns {Promise<object>} 降级结果
   */
  async demoteMember(containerRid, memberPath, options = {}) {
    const result = await this.containerService.demoteMember(containerRid, memberPath, options);

    // 记录操作日志
    if (this.syncOps) {
      await this.syncOps.recordOp('member_demoted', result.resource_rid, {
        container_rid: containerRid,
        member_path: memberPath,
        resource_exists: result.resource_exists
      });
    }

    return result;
  }

  /**
   * 获取容器成员统计
   * @param {string} containerRid
   */
  async getContainerMemberStats(containerRid) {
    return this.containerService.getMemberStats(containerRid);
  }

  /**
   * 按名称或 RID 解析容器
   * @param {string} identifier - 容器名称或 RID
   * @returns {Promise<string|null>}
   */
  _initOperationEngine() {
    this.operationRegistry = new OperationRegistry();

    // 自动加载 src/operations/ 下的所有 handler（Phase 4.5）
    loadOperations(this.operationRegistry);

    this.operationEngine = new OperationEngine(this.db, this.operationRegistry, this.containerService);
    this.operationEngine.setService('relationService', this.relationService);
    this.transactionEngine = new TransactionEngine(this.db, this.operationEngine);
  }

  async resolveContainer(identifier) {
    return this.containerService.resolve(identifier);
  }

  /**
   * 标记 Container 为 dirty（内容源文件变更，等待 sync）
   * @param {string} containerRid
   */
  async markContainerDirty(containerRid) {
    return this.syncEngine.markDirty(containerRid);
  }

  /**
   * 检查 Container 是否有待同步的变更
   * @param {string} containerRid
   * @returns {Promise<boolean>}
   */
  async isContainerDirty(containerRid) {
    return this.syncEngine.isDirty(containerRid);
  }

  /**
   * 忽略容器成员
   * @param {string} containerRid
   * @param {string} memberPath
   * @param {number} [sourceId]
   */
  async ignoreContainerMember(containerRid, memberPath, options = {}) {
    const result = await this.containerService.ignoreMember(containerRid, memberPath, options);
    if (this.syncOps) {
      await this.syncOps.recordOp('member_ignored', containerRid, {
        member_path: memberPath
      });
    }
    return result;
  }

  /**
   * 取消忽略容器成员
   * @param {string} containerRid
   * @param {string} memberPath
   * @param {number} [sourceId]
   */
  async unignoreContainerMember(containerRid, memberPath, options = {}) {
    const result = await this.containerService.unignoreMember(containerRid, memberPath, options);
    if (this.syncOps) {
      await this.syncOps.recordOp('member_unignored', containerRid, {
        member_path: memberPath
      });
    }
    return result;
  }

  // ────────── Phase 4.1: Member API ──────────

  /**
   * 自动事务包装：单个操作自动 begin→execute→commit，失败自动 rollback
   * @private
   */
  async _transactionalOp(containerRid, opType, opParams, options = {}) {
    if (options.transactionId) {
      // 在已有事务中执行
      return this.transactionEngine.execute(options.transactionId, opType, opParams, options);
    }
    // 自动事务
    const tx = await this.transactionEngine.begin({ containerRid, type: opType });
    try {
      const result = await this.transactionEngine.execute(tx.transactionId, opType, opParams, options);
      await this.transactionEngine.commit(tx.transactionId);
      return result;
    } catch (err) {
      await this.transactionEngine.rollback(tx.transactionId);
      throw err;
    }
  }

  /**
   * 重命名容器成员
   */
  async renameContainerMember(containerRid, memberPath, newPath, options = {}) {
    return this._transactionalOp(containerRid, 'member.rename', {
      containerRid, memberPath, newPath, sourceId: options.sourceId || null
    }, options);
  }

  /**
   * 软删除容器成员
   */
  async removeContainerMember(containerRid, memberPath, options = {}) {
    return this._transactionalOp(containerRid, 'member.remove', {
      containerRid, memberPath, sourceId: options.sourceId || null
    }, options);
  }

  /**
   * 恢复已删除的容器成员
   */
  async restoreContainerMember(containerRid, memberPath, options = {}) {
    return this._transactionalOp(containerRid, 'member.restore', {
      containerRid, memberPath, sourceId: options.sourceId || null
    }, options);
  }

  /**
   * 移动成员到另一个容器
   */
  async moveContainerMember(containerRid, memberPath, targetContainerRid, options = {}) {
    return this._transactionalOp(containerRid, 'member.move', {
      containerRid, memberPath, targetContainerRid, sourceId: options.sourceId || null
    }, options);
  }

  /**
   * 复制成员到另一个容器
   */
  async copyContainerMember(containerRid, memberPath, targetContainerRid, options = {}) {
    return this._transactionalOp(containerRid, 'member.copy', {
      containerRid, memberPath, targetContainerRid, sourceId: options.sourceId || null
    }, options);
  }

  /**
   * Phase 4.2: 获取容器的操作历史
   */
  async getContainerHistory(containerRid, options = {}) {
    return this.operationEngine.getHistory(containerRid, options);
  }

  /**
   * Phase 4.2: 获取特定成员的操作历史
   */
  async getMemberHistory(containerRid, memberPath) {
    return this.operationEngine.getMemberHistory(containerRid, memberPath);
  }

  /**
   * Phase 4.2: 撤销操作
   */
  async undoContainerOperation(operationId) {
    return this.operationEngine.undo(operationId);
  }

  // ────────── Phase 4.4: Transaction API ──────────

  /**
   * 开始一个事务（批量操作入口）
   */
  async beginTransaction(containerRid, type, description = null) {
    return this.transactionEngine.begin({ containerRid, type, description });
  }

  /**
   * 在事务中执行操作
   */
  async executeInTransaction(transactionId, type, params, options = {}) {
    return this.transactionEngine.execute(transactionId, type, params, options);
  }

  /**
   * 提交事务
   */
  async commitTransaction(transactionId) {
    return this.transactionEngine.commit(transactionId);
  }

  /**
   * 回滚事务
   */
  async rollbackTransaction(transactionId) {
    return this.transactionEngine.rollback(transactionId);
  }

  /**
   * 获取容器的事务列表
   */
  async getContainerTransactions(containerRid, options = {}) {
    return this.transactionEngine.getTransactions(containerRid, options);
  }

  /**
   * 获取事务详情
   */
  async getTransactionDetail(transactionId) {
    return this.transactionEngine.getTransaction(transactionId);
  }

  /**
   * 获取容器成员的内容变更差异（只读，不修改数据库）
   *
   * 遍历容器的所有 Content Source，对比文件系统与 container_members 表，
   * 返回每个 source 的新增/修改/删除文件列表。
   *
   * @param {string} containerRid
   * @returns {Promise<Array<{ source: string, added: Array, modified: Array, deleted: Array, unchanged: number }>>}
   */
  async getContainerDiff(containerRid) {
    if (!await this.containerService.hasContainerCapability(containerRid)) {
      throw new Error(`Resource ${containerRid} 不具有 Container Capability`);
    }
    return this.syncEngine.diff(containerRid);
  }

  /**
   * 同步容器成员：将文件系统的变化应用到数据库
   *
   * 对比文件系统与 container_members 表，然后:
   *   - 新增数据库中没有的文件
   *   - 更新 hash 变化的文件
   *   - 移除文件系统中已不存在的成员
   *
   * @param {string} containerRid
   * @returns {Promise<Array<{ source: string, added: number, updated: number, removed: number, errors: Array }>>}
   */
  async syncContainerMembers(containerRid) {
    if (!await this.containerService.hasContainerCapability(containerRid)) {
      throw new Error(`Resource ${containerRid} 不具有 Container Capability`);
    }
    return this.syncEngine.sync(containerRid);
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

  /**
   * 一致性检查：检查容器 ORPHAN_RESOURCE / ORPHAN_SOURCE / INVALID_STATUS / ORPHAN_OPERATION
   *
   * @param {string} containerRid
   * @returns {Promise<{ issues: Array }>}
   */
  async verifyContainer(containerRid) {
    const issues = [];
    const MemberStateMachine = require('../domain/memberStateMachine.cjs');

    // 1. Member 检查
    const members = await this.db.all(
      'SELECT * FROM container_members WHERE container_rid = ?',
      [containerRid]
    );

    for (const m of members) {
      // 1a. ORPHAN_RESOURCE: promoted 但 resource_rid 不存在
      if (m.resource_rid) {
        const res = await this.db.get('SELECT rid FROM resources WHERE rid = ?', [m.resource_rid]);
        if (!res) {
          issues.push({
            level: 'error',
            category: 'ORPHAN_RESOURCE',
            message: `member ${m.path} (id=${m.id}) promoted but resource ${m.resource_rid} missing`,
            member: m.path,
            detail: { memberId: m.id, resourceRid: m.resource_rid }
          });
        }
      }

      // 1b. ORPHAN_SOURCE: source_id 存在但 resource_sources 不存在
      if (m.source_id) {
        const src = await this.db.get('SELECT id FROM resource_sources WHERE id = ?', [m.source_id]);
        if (!src) {
          issues.push({
            level: 'error',
            category: 'ORPHAN_SOURCE',
            message: `member ${m.path} (id=${m.id}) references missing source ${m.source_id}`,
            member: m.path,
            detail: { memberId: m.id, sourceId: m.source_id }
          });
        }
      }

      // 1c. INVALID_STATUS: 状态值不在合法范围内
      if (m.status && !MemberStateMachine.isValidStatus(m.status)) {
        issues.push({
          level: 'error',
          category: 'INVALID_STATUS',
          message: `member ${m.path} (id=${m.id}) has invalid status: ${m.status}`,
          member: m.path,
          detail: { memberId: m.id, status: m.status }
        });
      }
    }

    // 2. Operation 检查
    const ops = await this.db.all(
      'SELECT * FROM container_operations WHERE container_rid = ?',
      [containerRid]
    );

    for (const op of ops) {
      // 检查 before/after JSON 合法性
      if (op.before) {
        try { JSON.parse(op.before); } catch (e) {
          issues.push({
            level: 'warn',
            category: 'CORRUPT_OPERATION',
            message: `operation ${op.operation_id} has invalid before JSON`,
            detail: { operationId: op.operation_id }
          });
        }
      }
      if (op.after) {
        try { JSON.parse(op.after); } catch (e) {
          issues.push({
            level: 'warn',
            category: 'CORRUPT_OPERATION',
            message: `operation ${op.operation_id} has invalid after JSON`,
            detail: { operationId: op.operation_id }
          });
        }
      }

      // 检查 transaction_id 引用
      if (op.transaction_id) {
        const tx = await this.db.get(
          'SELECT transaction_id FROM container_transactions WHERE transaction_id = ?',
          [op.transaction_id]
        );
        if (!tx) {
          issues.push({
            level: 'warn',
            category: 'ORPHAN_OPERATION',
            message: `operation ${op.operation_id} references missing transaction ${op.transaction_id}`,
            detail: { operationId: op.operation_id, transactionId: op.transaction_id }
          });
        }
      }
    }

    // 3. Transaction 检查
    const txs = await this.db.all(
      'SELECT * FROM container_transactions WHERE container_rid = ?',
      [containerRid]
    );

    for (const tx of txs) {
      // 检查状态合法性
      const validTxStatuses = ['active', 'committed', 'rolled_back', 'failed'];
      if (!validTxStatuses.includes(tx.status)) {
        issues.push({
          level: 'error',
          category: 'INVALID_TX_STATUS',
          message: `transaction ${tx.transaction_id} has invalid status: ${tx.status}`,
          detail: { transactionId: tx.transaction_id, status: tx.status }
        });
      }
    }

    return { containerRid, issues, ok: issues.length === 0 };
  }

  /**
   * 获取所有已注册的操作类型
   */
  getOperationTypes() {
    return this.operationRegistry.list();
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
      return this.relationService.removeByTriple(ridA, ridB, type);
    }
    await this.relationService.removeByTriple(ridA, ridB, type);
    await this.relationService.removeByTriple(ridB, ridA, type);
    return { removed: true };
  }

  /**
   * Phase 5.1: 创建关系
   * Phase 5.2: 通过 OperationEngine 执行（获得 undo/redo/history）
   */
  async createRelation(fromRid, toRid, type = 'reference', metadata = {}) {
    const { result } = await this.operationEngine.execute('relation.create', {
      fromRid, toRid, type, metadata
    });
    this._invalidateGraphCache();
    return result;
  }

  /**
   * Phase 5.1: 软删除关系（按 id）
   * Phase 5.2: 通过 OperationEngine 执行
   */
  async removeRelation(id) {
    // 预加载完整关系数据用于 undo 重建
    const rel = await this.relationService.getById(id);
    if (!rel) throw new Error(`关系不存在: ${id}`);

    const { result } = await this.operationEngine.execute('relation.remove', {
      id,
      fromRid: rel.from_rid,
      toRid: rel.to_rid,
      type: rel.type,
      metadata: rel.metadata
    });
    this._invalidateGraphCache();
    return result;
  }

  /**
   * Phase 5.1: 更新关系
   * Phase 5.2: 通过 OperationEngine 执行
   */
  async updateRelation(id, updates) {
    // 读取旧状态用于 undo
    const old = await this.relationService.getById(id);
    if (!old) throw new Error(`关系不存在: ${id}`);

    const params = {
      id,
      updates,
      oldType: old.type,
      oldMetadata: old.metadata
    };

    const { result } = await this.operationEngine.execute('relation.update', params);
    this._invalidateGraphCache();
    return result;
  }

  /**
   * Phase 5.1: 获取单条关系
   */
  async getRelation(id) {
    return this.relationService.getById(id);
  }

  /**
   * Phase 5.1: 列出关系（支持过滤）
   */
  async listRelations(filter = {}) {
    return this.relationService.listAll(filter);
  }

  // ──────────────────────────────────────
  // Phase 5.3: Graph API
  // ──────────────────────────────────────

  /**
   * 构建资源关系图
   */
  async getGraph() {
    if (this._graphCache && this._graphCache.has()) {
      return this._graphCache.get();
    }
    const relations = await this.relationService.listAll({ limit: 10000 });
    const builder = new GraphBuilder();
    const graph = builder.build(relations);
    if (this._graphCache) this._graphCache.set(graph);
    return graph;
  }

  /**
   * 使图缓存失效（relation 变更后调用）
   */
  _invalidateGraphCache() {
    if (this._graphCache) this._graphCache.invalidate();
  }

  async _getGraphEngine() {
    const graph = await this.getGraph();
    return new GraphEngine(graph);
  }

  async getNeighbors(rid) {
    const engine = await this._getGraphEngine();
    return engine.neighbors(rid);
  }

  async getBacklinks(rid) {
    const engine = await this._getGraphEngine();
    return engine.incoming(rid);
  }

  async getOutgoingLinks(rid) {
    const engine = await this._getGraphEngine();
    return engine.outgoing(rid);
  }

  async findPath(fromRid, toRid) {
    const engine = await this._getGraphEngine();
    return engine.findPath(fromRid, toRid);
  }

  async detectCycles() {
    const engine = await this._getGraphEngine();
    return engine.detectCycles();
  }

  async getReachable(rid) {
    const engine = await this._getGraphEngine();
    return engine.reachable(rid);
  }

  async getSubGraph(rid, depth = 2) {
    const engine = await this._getGraphEngine();
    return engine.subGraph(rid, depth);
  }

  async getGraphStats() {
    const engine = await this._getGraphEngine();
    return engine.stats();
  }

  /**
   * Phase 5.4: PageRank 分析
   */
  async getPageRank(options) {
    const engine = await this._getGraphEngine();
    return engine.pageRank(options);
  }

  /**
   * Phase 5.4: 中心节点
   */
  async getCentralNodes(topN) {
    const engine = await this._getGraphEngine();
    return engine.centralNodes(topN);
  }

  /**
   * Phase 5.4: 孤立节点
   */
  async getIsolatedNodes() {
    const engine = await this._getGraphEngine();
    return engine.isolatedNodes();
  }

  /**
   * Phase 5.4: 聚簇分析
   */
  async getClusters() {
    const engine = await this._getGraphEngine();
    return engine.clusters();
  }

  /**
   * Phase 5.4: 图查询 DSL
   * @returns {GraphQueryBuilder}
   */
  queryGraph() {
    // queryGraph 每次都重建（保证最新），不使用缓存
    const relationsPromise = this.relationService.listAll({ limit: 10000 });
    // 返回 lazy builder，在 run() 时才执行查询
    return {
      from: (rid) => this._buildQuery(rid, relationsPromise)
    };
  }

  async _buildQuery(rid, relationsPromise) {
    const relations = await relationsPromise;
    const builder = new GraphBuilder();
    const graph = builder.build(relations);
    const engine = new GraphEngine(graph);
    return new GraphQueryBuilder(engine).from(rid);
  }

  // ──────────────────────────────────────
  // Phase 5.5: Knowledge Navigation API
  // ──────────────────────────────────────

  async _getNavigationEngine() {
    const engine = await this._getGraphEngine();
    return new NavigationEngine(engine);
  }

  /**
   * 相关资源推荐
   */
  async getRelatedResources(rid, options) {
    const nav = await this._getNavigationEngine();
    return nav.related(rid, options);
  }

  /**
   * 反向链接详情（带关系类型）
   */
  async getBacklinkDetails(rid) {
    const nav = await this._getNavigationEngine();
    return nav.backlinks(rid);
  }

  /**
   * 资源邻域视图
   */
  async getResourceNeighborhood(rid, depth = 2) {
    const nav = await this._getNavigationEngine();
    return nav.neighborhood(rid, { depth });
  }

  /**
   * 知识路径解释
   */
  async getExplainPath(a, b) {
    const nav = await this._getNavigationEngine();
    return nav.explainPath(a, b);
  }

  /**
   * 影响分析
   */
  async analyzeImpact(rid) {
    const nav = await this._getNavigationEngine();
    return nav.impact(rid);
  }

  // ──────────────────────────────────────
  // Phase 5.6: Visualization API
  // ──────────────────────────────────────

  async _getVisualizationEngine() {
    const engine = await this._getGraphEngine();
    return new VisualizationEngine(engine);
  }

  /**
   * 可视化图（支持完整/邻域/类型三种视图）
   */
  async visualizeGraph(options = {}) {
    const ve = await this._getVisualizationEngine();
    return ve.visualize(options);
  }

  /**
   * 导出可视化结果
   */
  async exportVisualGraph(options = {}) {
    const { format = 'json', layout = 'force', rid, depth, type: graphType, width, height } = options;
    const ve = await this._getVisualizationEngine();

    let vg;
    if (rid) {
      vg = ve.visualizeNeighborhood(rid, { depth: depth || 2, layout, width, height });
    } else if (graphType) {
      vg = ve.visualizeByType(graphType, { layout, width, height });
    } else {
      vg = ve.visualizeFull({ layout, width, height });
    }

    if (!vg) throw new Error('Visualization failed');

    const exporter = new VisualExporter(vg, { width, height });

    switch (format) {
      case 'html': return exporter.toHTML();
      case 'svg':  return exporter.toSVG();
      case 'json': return exporter.toJSON();
      default: throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  // ──────────────────────────────────────
  // Phase 5.7: Knowledge Intelligence API
  // ──────────────────────────────────────

  async _getKnowledgeAnalyzer() {
    const engine = await this._getGraphEngine();
    const nav = await this._getNavigationEngine();
    return new KnowledgeAnalyzer(engine, nav);
  }

  /**
   * 知识分析报告
   */
  async analyzeKnowledge() {
    const analyzer = await this._getKnowledgeAnalyzer();
    return analyzer.report();
  }

  /**
   * 知识密度
   */
  async getKnowledgeDensity() {
    const analyzer = await this._getKnowledgeAnalyzer();
    return analyzer.density();
  }

  /**
   * 知识缺口检测
   */
  async findKnowledgeGaps(options) {
    const analyzer = await this._getKnowledgeAnalyzer();
    return analyzer.gaps(options);
  }

  /**
   * 推荐
   */
  async _getRecommendationEngine() {
    const engine = await this._getGraphEngine();
    const nav = await this._getNavigationEngine();
    return new RecommendationEngine(engine, nav);
  }

  async getRecommendations(rid, options) {
    const rec = await this._getRecommendationEngine();
    return rec.related(rid, options);
  }

  async getNextLearning(rid, options) {
    const rec = await this._getRecommendationEngine();
    return rec.nextLearning(rid, options);
  }

  async getForgottenKnowledge(options) {
    const rec = await this._getRecommendationEngine();
    return rec.forgotten(options);
  }

  /**
   * 知识演化时间线
   */
  async getKnowledgeTimeline() {
    const timeline = new KnowledgeTimeline(this.db);
    const [monthly, growth, activity] = await Promise.all([
      timeline.monthly(),
      timeline.growthRate(),
      timeline.activity()
    ]);
    return { monthly, growth, activity };
  }

  // ──────────────────────────────────────
  // Phase 5.8: AI Assisted Knowledge Graph
  // ──────────────────────────────────────

  /**
   * 获取 AI 上下文构建器
   */
  async _getAIContextBuilder() {
    const engine = await this._getGraphEngine();
    const nav = await this._getNavigationEngine();
    const analyzer = await this._getKnowledgeAnalyzer();
    const resolveName = (rid) => {
      try { return this.rs.get(rid); } catch { return { name: rid }; }
    };
    return new AIContextBuilder(engine, nav, analyzer, resolveName);
  }

  /**
   * 构建 AI 上下文（用于外部 AI API 调用）
   */
  async buildAIContext(rid) {
    const builder = await this._getAIContextBuilder();
    if (rid) {
      return builder.buildResourceContext(rid);
    }
    return builder.buildGlobalContext();
  }

  /**
   * 构建对话上下文
   */
  async buildChatContext(query) {
    const builder = await this._getAIContextBuilder();
    return builder.buildChatContext(query);
  }

  /**
   * 生成 AI 建议（基于规则引擎）
   */
  async generateSuggestions(options) {
    const engine = await this._getGraphEngine();
    const nav = await this._getNavigationEngine();
    const semantic = new SemanticRelationEngine(engine, nav);
    const suggestions = semantic.suggest(options);

    // 保存到数据库
    const se = new SuggestionEngine(this.db);
    await se.createBatch(suggestions.map(s => ({
      type: 'relation',
      source: s.source,
      target: s.target,
      confidence: s.confidence,
      reason: s.reason,
      payload: { suggestedType: s.suggestedType }
    })));

    return suggestions;
  }

  /**
   * 获取建议列表
   */
  async listSuggestions(options) {
    const se = new SuggestionEngine(this.db);
    return se.list(options);
  }

  /**
   * 批准建议（只改状态，不执行操作）
   */
  async approveSuggestion(id) {
    const se = new SuggestionEngine(this.db);
    return se.approve(id);
  }

  /**
   * 执行已批准的建议（创建 relation）
   */
  async executeApprovedSuggestion(id) {
    const se = new SuggestionEngine(this.db);
    const suggestion = await se.get(id);
    if (!suggestion) throw new Error('建议不存在');
    if (suggestion.status !== 'approved') throw new Error('建议尚未审批');

    if (suggestion.type === 'relation' && suggestion.source && suggestion.target) {
      const relType = (suggestion.payload && suggestion.payload.suggestedType) || 'reference';
      return this.createRelation(suggestion.source, suggestion.target, relType);
    }
    throw new Error(`不支持的建议类型: ${suggestion.type}`);
  }

  /**
   * 拒绝建议
   */
  async rejectSuggestion(id) {
    const se = new SuggestionEngine(this.db);
    return se.reject(id);
  }

  /**
   * 建议统计
   */
  async getSuggestionStats() {
    const se = new SuggestionEngine(this.db);
    return se.stats();
  }

  /**
   * AI 知识问答
   * @param {string} query
   */
  async askKnowledge(query) {
    const builder = await this._getAIContextBuilder();
    const analyzer = await this._getKnowledgeAnalyzer();
    const rec = await this._getRecommendationEngine();
    const assistant = new KnowledgeAssistant(builder, analyzer, rec);
    return assistant.ask(query);
  }

  /**
   * AI 解释资源
   * @param {string} rid
   */
  async explainWithAI(rid) {
    const builder = await this._getAIContextBuilder();
    const analyzer = await this._getKnowledgeAnalyzer();
    const assistant = new KnowledgeAssistant(builder, analyzer);
    return assistant.explain(rid);
  }

  /**
   * AI 摘要资源
   * @param {string} rid
   */
  async summarizeWithAI(rid) {
    const builder = await this._getAIContextBuilder();
    const analyzer = await this._getKnowledgeAnalyzer();
    const assistant = new KnowledgeAssistant(builder, analyzer);
    return assistant.summarize(rid);
  }

  /**
   * AI Memory 操作
   */
  async getAIMemory() {
    return new AIMemory(this.db);
  }

  // ──────────────────────────────────────
  // Phase 5.9: Knowledge OS Automation
  // ──────────────────────────────────────

  /**
   * 获取知识修复引擎
   */
  async _getKnowledgeRepair() {
    const engine = await this._getGraphEngine();
    return new KnowledgeRepair(this.db, engine);
  }

  /**
   * 获取知识调度器
   */
  _getKnowledgeScheduler() {
    const services = {};
    // Lazy: 异步获取服务引用（尽量避免在构造时加载引擎）
    return {
      db: this.db,
      services,
      _repo: this,
      async runAll() {
        const repo = this._repo;
        services.graphEngine = await repo._getGraphEngine();
        try { services.knowledgeAnalyzer = await repo._getKnowledgeAnalyzer(); } catch {}
        try { services.recommendationEngine = await repo._getRecommendationEngine(); } catch {}
        try { services.knowledgeRepair = await repo._getKnowledgeRepair(); } catch {}
        const se = new SuggestionEngine(repo.db);
        services.suggestionEngine = se;
        const scheduler = new KnowledgeScheduler(repo.db, services);
        return scheduler.runAll();
      },
      async scanForgotten() {
        const repo = this._repo;
        services.graphEngine = await repo._getGraphEngine();
        const scheduler = new KnowledgeScheduler(repo.db, services);
        return scheduler.scanForgottenResources();
      },
      async analyzeHealth() {
        const repo = this._repo;
        try { services.knowledgeAnalyzer = await repo._getKnowledgeAnalyzer(); } catch {}
        try { services.knowledgeRepair = await repo._getKnowledgeRepair(); } catch {}
        const scheduler = new KnowledgeScheduler(repo.db, services);
        return scheduler.analyzeKnowledgeHealth();
      },
      async generateReport() {
        const repo = this._repo;
        services.graphEngine = await repo._getGraphEngine();
        try { services.knowledgeAnalyzer = await repo._getKnowledgeAnalyzer(); } catch {}
        try { services.knowledgeRepair = await repo._getKnowledgeRepair(); } catch {}
        const scheduler = new KnowledgeScheduler(repo.db, services);
        return scheduler.generateKnowledgeReport();
      }
    };
  }

  /**
   * 获取资源生命周期状态
   */
  async getKnowledgeLifecycle() {
    const resources = await this.db.all(`
      SELECT rid, name, created, updated FROM resources WHERE deleted = 0
    `);

    // 获取最后关系时间
    const lastRels = await this.db.all(`
      SELECT r.from_rid, MAX(r.created) as last_rel
      FROM relations r WHERE r.deleted = 0
      GROUP BY r.from_rid
    `);
    const relMap = new Map();
    for (const r of lastRels) {
      relMap.set(r.from_rid, r.last_rel || 0);
    }

    // 获取 PageRank 评分
    let pageRanks = new Map();
    try {
      const engine = await this._getGraphEngine();
      const pr = engine.pageRank({ iterations: 20, damping: 0.85 });
      for (const r of pr) pageRanks.set(r.rid, r.score);
    } catch {}

    const inputs = resources.map(r => ({
      rid: r.rid,
      name: r.name,
      score: pageRanks.get(r.rid) || 0,
      lastRelation: relMap.get(r.rid) || 0,
      created: r.created,
      updated: r.updated
    }));

    const lifecycles = ResourceLifecycle.batch(inputs);
    const summary = ResourceLifecycle.summary(lifecycles);

    return {
      summary,
      resources: lifecycles.map(lc => lc.toJSON())
    };
  }

  /**
   * 运行知识修复诊断
   */
  async runKnowledgeRepair() {
    const repair = await this._getKnowledgeRepair();
    return repair.diagnose();
  }

  /**
   * 运行完整自动化管线
   */
  async runAutomation() {
    const scheduler = this._getKnowledgeScheduler();
    return scheduler.runAll();
  }

  /**
   * 扫描遗忘资源
   */
  async scanForgottenResources() {
    const scheduler = this._getKnowledgeScheduler();
    return scheduler.scanForgotten();
  }

  /**
   * 分析知识健康度
   */
  async analyzeKnowledgeHealth() {
    const scheduler = this._getKnowledgeScheduler();
    return scheduler.analyzeHealth();
  }

  /**
   * 资源文件监控
   */
  async watchResources() {
    const watcher = new ResourceWatcher(this.db, this.repoPath);
    return watcher.check();
  }

  /**
   * 获取知识事件记录
   * @param {{ type?: string, limit?: number }} options
   */
  async getKnowledgeEvents(options = {}) {
    const { type, limit = 50 } = options;
    let sql = 'SELECT * FROM knowledge_events';
    const params = [];

    if (type) {
      sql += ' WHERE type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created DESC LIMIT ?';
    params.push(limit);

    const rows = await this.db.all(sql, params);
    return rows.map(r => ({
      id: r.id,
      type: r.type,
      rid: r.rid,
      payload: (() => { try { return JSON.parse(r.payload || '{}'); } catch { return {}; } })(),
      created: r.created
    }));
  }

  // ──────────────────────────────────────
  // Phase 5.10: Distributed Knowledge Graph
  // ──────────────────────────────────────

  /**
   * 获取联邦管理器
   */
  getFederationManager() {
    return new FederationManager(this.db, this.repoPath);
  }

  /**
   * 获取联邦图引擎
   */
  getFederatedGraphEngine() {
    return new FederatedGraphEngine();
  }

  /**
   * 获取同步引擎
   */
  getSyncEngine() {
    return new SyncEngine(this.db, this.repoPath);
  }

  /**
   * 联邦仓库操作
   */
  async registerFederatedRepository(name, namespace, repoPath) {
    const fm = this.getFederationManager();
    return fm.register({ name, namespace, repoPath });
  }

  async removeFederatedRepository(namespaceOrName) {
    const fm = this.getFederationManager();
    return fm.remove(namespaceOrName);
  }

  async listFederatedRepositories() {
    const fm = this.getFederationManager();
    return fm.list();
  }

  /**
   * 构建联邦图
   * @param {string} localNamespace
   */
  async buildFederatedGraph(localNamespace) {
    const fm = this.getFederationManager();
    const sources = await fm.list();
    const engine = this.getFederatedGraphEngine();
    return engine.buildFederatedGraph(sources, this.repoPath, localNamespace || 'local');
  }

  /**
   * 同步: pull
   */
  async syncPull(namespace) {
    const fm = this.getFederationManager();
    const repo = await fm.getByNamespace(namespace);
    if (!repo) throw new Error(`Unknown namespace: ${namespace}`);

    const se = this.getSyncEngine();
    return se.pull(repo.path, namespace);
  }

  /**
   * 同步: push
   */
  async syncPush(namespace) {
    const fm = this.getFederationManager();
    const repo = await fm.getByNamespace(namespace);
    if (!repo) throw new Error(`Unknown namespace: ${namespace}`);

    const se = this.getSyncEngine();
    return se.push(repo.path, namespace);
  }

  /**
   * 同步状态
   */
  async getSyncStatus() {
    const se = this.getSyncEngine();
    return se.status();
  }

  /**
   * 冲突列表
   */
  async listConflicts(options) {
    const se = this.getSyncEngine();
    return se.listConflicts(options);
  }

  /**
   * 解决冲突
   */
  async resolveConflict(conflictId, strategy) {
    const se = this.getSyncEngine();
    return se.resolveConflict(conflictId, strategy);
  }

  /**
   * 在联邦中查找资源
   */
  async resolveFederatedResource(ridOrName) {
    const fm = this.getFederationManager();
    return fm.resolveResource(ridOrName);
  }

  /**
   * 联邦图查询
   * @param {string} fromId - globalId
   * @param {{ depth?: number, sources?: Array<string> }} options
   */
  async queryFederatedGraph(fromId, options = {}) {
    const { depth = 3, sources = null } = options;
    const localNS = 'local'; // 当前仓库用 local namespace
    const result = await this.buildFederatedGraph(localNS);
    const engine = this.getFederatedGraphEngine();
    return engine.queryFederated(result.graph, fromId, depth, sources);
  }

  /**
   * 获取同步历史
   */
  async getSyncHistory(limit = 20) {
    const se = this.getSyncEngine();
    return se.syncHistory(limit);
  }

  // ──────────────────────────────────────
  // Phase 5.11: Knowledge Evolution & Collective Intelligence
  // ──────────────────────────────────────

  /**
   * 获取知识演化引擎
   */
  async _getEvolutionEngine() {
    const engine = await this._getGraphEngine();
    return new KnowledgeEvolutionEngine(this.db, engine);
  }

  /**
   * 获取知识模式引擎
   */
  async _getPatternEngine() {
    const engine = await this._getGraphEngine();
    return new KnowledgePatternEngine(engine, this.db);
  }

  /**
   * 获取知识策略引擎
   */
  async _getStrategyEngine() {
    const engine = await this._getGraphEngine();
    const ee = new KnowledgeEvolutionEngine(this.db, engine);
    const pe = null; // lazy
    return new KnowledgeStrategyEngine(this.db, { graphEngine: engine, evolutionEngine: ee });
  }

  /**
   * 获取演化记忆
   */
  getEvolutionMemory() {
    return new EvolutionMemory(this.db);
  }

  /**
   * 知识演化分析
   */
  async analyzeEvolution(options = {}) {
    const ee = await this._getEvolutionEngine();
    return ee.analyze(options);
  }

  /**
   * 知识模式检测
   */
  async detectKnowledgePatterns(options = {}) {
    const pe = await this._getPatternEngine();
    return pe.detectAll(options);
  }

  /**
   * 生成知识策略
   */
  async generateKnowledgeStrategy() {
    const engine = await this._getGraphEngine();
    const ee = new KnowledgeEvolutionEngine(this.db, engine);

    let pe = null;
    try { pe = await this._getPatternEngine(); } catch {}

    const se = new KnowledgeStrategyEngine(this.db, {
      graphEngine: engine,
      evolutionEngine: ee,
      patternEngine: pe
    });

    return se.generate();
  }

  /**
   * 集体知识分析
   */
  async collectiveKnowledgeAnalysis() {
    const fm = this.getFederationManager();
    const ce = new CollectiveKnowledgeEngine(this.db, fm);
    return ce.analyze();
  }

  /**
   * 创建知识快照
   */
  async createKnowledgeSnapshot() {
    const em = this.getEvolutionMemory();

    // Gather current stats
    const [resCount, relCount] = await Promise.all([
      this.db.get('SELECT COUNT(*) as c FROM resources WHERE deleted = 0'),
      this.db.get('SELECT COUNT(*) as c FROM relations WHERE deleted = 0')
    ]);

    let density = 0;
    let entropy = 0;
    let growth = 0;

    try {
      const engine = await this._getGraphEngine();
      const analyzer = new (require('./knowledgeAnalyzer.cjs'))(engine);
      const d = await analyzer.density();
      density = d.density;

      const ee = new KnowledgeEvolutionEngine(this.db, engine);
      const ent = await ee.entropy();
      entropy = ent.normalized;

      const gr = await ee.growthRate(30);
      growth = gr.rate;
    } catch {}

    return em.createSnapshot({
      resourceCount: resCount ? resCount.c : 0,
      relationCount: relCount ? relCount.c : 0,
      density,
      entropy,
      growth
    });
  }

  /**
   * 列出知识快照
   */
  async listKnowledgeSnapshots(limit = 20) {
    const em = this.getEvolutionMemory();
    return em.list({ limit });
  }

  /**
   * 比较快照
   */
  async compareSnapshots(snapshotId) {
    const em = this.getEvolutionMemory();
    return em.compare(snapshotId);
  }

  // ──────────────────────────────────────
  // Phase 6.1: Plugin System
  // ──────────────────────────────────────

  /**
   * 获取 PluginManager（懒初始化）
   */
  getPluginManager() {
    if (!this._pluginManager) {
      this._pluginManager = new PluginManager({
        pluginsDir: path.join(__dirname, '..', 'plugins'),
        repository: this,
        db: this.db,
        eventBus: this._getEventBus()
      });
    }
    return this._pluginManager;
  }

  /**
   * 初始化插件系统
   */
  async initPluginSystem() {
    const pm = this.getPluginManager();
    await pm.initialize();
    return pm.listPlugins();
  }

  /**
   * 列出插件
   */
  async listPlugins() {
    const pm = this.getPluginManager();
    return pm.listPlugins();
  }

  /**
   * 安装插件
   */
  async installPlugin(pluginPath) {
    const pm = this.getPluginManager();
    return pm.loadPlugin(pluginPath);
  }

  /**
   * 卸载插件
   */
  async uninstallPlugin(id) {
    const pm = this.getPluginManager();
    return pm.unloadPlugin(id);
  }

  /**
   * 启用插件
   */
  async enablePlugin(id) {
    const pm = this.getPluginManager();
    return pm.enablePlugin(id);
  }

  /**
   * 禁用插件
   */
  async disablePlugin(id) {
    const pm = this.getPluginManager();
    return pm.disablePlugin(id);
  }

  /**
   * 重载插件
   */
  async reloadPlugin(id) {
    const pm = this.getPluginManager();
    return pm.reloadPlugin(id);
  }

  /**
   * 获取插件管理器 Hook/Action
   */
  getPluginHookManager() {
    return this.getPluginManager().getHookManager();
  }

  getPluginExtensionRegistry() {
    return this.getPluginManager().getExtensionRegistry();
  }

  // ──────────────────────────────────────
  // Phase 6.2: Event Bus System
  // ──────────────────────────────────────

  /**
   * 获取 EventBus（懒初始化）
   */
  _getEventBus() {
    if (!this._eventBus) {
      const store = new EventStore(this.db);
      const middleware = new EventMiddleware();

      // 默认日志中间件
      middleware.register('afterEmit', (event) => {
        // Lightweight logging
        if (event.type !== 'resource.updated') {
          // Debug: console.log(`[event] ${event.type} (${event.source})`);
        }
        return event;
      }, -100);

      this._eventBus = new EventBus({ store, middleware });
    }
    return this._eventBus;
  }

  /**
   * 发布事件
   * @param {string} type — 事件类型
   * @param {any} payload — 事件数据
   * @param {{ source?: string, metadata?: object }} options
   */
  emitEvent(type, payload, options = {}) {
    const bus = this._getEventBus();
    return bus.emit({
      type,
      payload,
      source: options.source || 'repository',
      metadata: options.metadata || {}
    });
  }

  /**
   * 注册事件监听器
   */
  onEvent(type, handler) {
    const bus = this._getEventBus();
    bus.on(type, handler);
  }

  /**
   * 获取事件历史
   */
  async getEventHistory(options = {}) {
    const store = new EventStore(this.db);
    return store.query(options);
  }

  /**
   * 事件统计
   */
  async getEventStats() {
    const store = new EventStore(this.db);
    return store.typeStats();
  }

  /**
   * Event Replay
   */
  async replayEvents(options = {}) {
    const store = new EventStore(this.db);
    return store.replay(options);
  }

  /**
   * 获取事件监听器列表
   */
  getEventListeners(type) {
    const bus = this._getEventBus();
    return bus.listeners(type);
  }

  getRegisteredEventTypes() {
    const bus = this._getEventBus();
    return bus.registeredTypes();
  }

  // ──────────────────────────────────────
  // Phase 6.3: Workflow Engine
  // ──────────────────────────────────────

  /**
   * 获取 WorkflowEngine（懒初始化）
   */
  _getWorkflowEngine() {
    if (!this._workflowEngine) {
      const conditionEngine = new ConditionEngine({ logger: this.logger || console });

      const stepExecutor = new StepExecutor({
        repository: this,
        pluginManager: this._pluginManager,
        conditionEngine,
        logger: this.logger || console
      });

      const registry = new WorkflowRegistry(this.db);

      this._workflowEngine = new WorkflowEngine({
        db: this.db,
        registry,
        stepExecutor,
        conditionEngine,
        eventBus: this._getEventBus(),
        logger: this.logger || console
      });

      // 初始化调度器
      this._workflowScheduler = new WorkflowScheduler({
        eventBus: this._getEventBus(),
        workflowEngine: this._workflowEngine,
        logger: this.logger || console
      });
    }
    return this._workflowEngine;
  }

  /**
   * 初始化工作流系统
   */
  async initWorkflowSystem() {
    const engine = this._getWorkflowEngine();
    const loaded = await engine.registry.load();

    // 注册内置工作流
    if (loaded === 0) {
      await this._registerBuiltinWorkflows();
    }

    return engine;
  }

  /**
   * 注册内置工作流
   */
  async _registerBuiltinWorkflows() {
    const engine = this._getWorkflowEngine();

    // Knowledge Cleanup
    const cleanup = new Workflow({
      id: 'knowledge_cleanup',
      name: '知识清理',
      description: '检测遗忘知识并生成复习建议',
      trigger: { type: 'manual' },
      steps: [
        { id: 'analyze', type: 'analysis', config: {} },
        { id: 'suggest', type: 'ai', config: { generateSuggestions: true } },
        { id: 'notify', type: 'notification', config: { message: '知识清理完成' } }
      ]
    });
    await engine.register(cleanup);

    // AI Summary
    const aiSummary = new Workflow({
      id: 'ai_summary',
      name: 'AI 摘要生成',
      description: '为新资源生成 AI 摘要',
      trigger: { type: 'event', event: 'resource.created' },
      steps: [
        { id: 'analyze', type: 'analysis', config: {} },
        { id: 'summarize', type: 'ai', config: { query: '总结最近创建的资源' } },
        { id: 'notify', type: 'notification', config: { message: 'AI 摘要已生成' } }
      ]
    });
    await engine.register(aiSummary);

    // Knowledge Review
    const review = new Workflow({
      id: 'knowledge_review',
      name: '知识审查',
      description: '定期审查重要知识',
      trigger: { type: 'schedule', schedule: { cron: 'weekly', time: '09:00' } },
      steps: [
        { id: 'check', type: 'condition', config: { condition: 'true' } },
        { id: 'analyze', type: 'analysis', config: {} },
        { id: 'notify', type: 'notification', config: { message: '知识审查完成' } }
      ]
    });
    await engine.register(review);
  }

  /**
   * 创建工作流
   */
  async createWorkflow(def) {
    const engine = this._getWorkflowEngine();
    const wf = new Workflow(def);
    await engine.register(wf);
    return wf.toJSON();
  }

  /**
   * 列出工作流
   */
  async listWorkflows() {
    const engine = this._getWorkflowEngine();
    return engine.listWorkflows();
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(id, input) {
    const engine = this._getWorkflowEngine();
    return engine.execute(id, input);
  }

  /**
   * 暂停工作流
   */
  async pauseWorkflow(executionId) {
    const engine = this._getWorkflowEngine();
    return engine.pause(executionId);
  }

  /**
   * 恢复工作流
   */
  async resumeWorkflow(executionId) {
    const engine = this._getWorkflowEngine();
    return engine.resume(executionId);
  }

  /**
   * 取消工作流
   */
  async cancelWorkflow(executionId) {
    const engine = this._getWorkflowEngine();
    return engine.cancel(executionId);
  }

  /**
   * 工作流执行状态
   */
  async getWorkflowStatus(executionId) {
    const engine = this._getWorkflowEngine();
    return engine.status(executionId);
  }

  /**
   * 工作流执行历史
   */
  async getWorkflowHistory(workflowId, limit) {
    const engine = this._getWorkflowEngine();
    return engine.getHistory(workflowId, limit);
  }

  // ──────────────────────────────────────
  // Phase 6.4: Permission System
  // ──────────────────────────────────────

  _getPermissionManager() {
    if (!this._permissionManager) {
      this._permissionManager = new PermissionManager(this.db);
      this._permissionManager.initialize().catch(() => {});
    }
    return this._permissionManager;
  }

  _getPolicyEngine() {
    if (!this._policyEngine) {
      this._policyEngine = new PolicyEngine({
        permissionManager: this._getPermissionManager(),
        audit: new PermissionAudit(this.db)
      });
    }
    return this._policyEngine;
  }

  async checkPermission(subject, action, resource) {
    const engine = this._getPolicyEngine();
    return engine.check(subject, action, resource);
  }

  async initPermissionSystem() {
    const pm = this._getPermissionManager();
    await pm.initialize();
    return pm;
  }

  async createRole(def) {
    const pm = this._getPermissionManager();
    return pm.createRole(def);
  }

  async listRoles() {
    const pm = this._getPermissionManager();
    return pm.listRoles();
  }

  async assignRole(subjectId, roleId) {
    const pm = this._getPermissionManager();
    return pm.assignRole(subjectId, roleId);
  }

  async unassignRole(subjectId, roleId) {
    const pm = this._getPermissionManager();
    return pm.unassignRole(subjectId, roleId);
  }

  async grantPermission(subjectId, action) {
    const pm = this._getPermissionManager();
    return pm.grantPermission(subjectId, action);
  }

  async revokePermission(subjectId, action) {
    const pm = this._getPermissionManager();
    return pm.revokePermission(subjectId, action);
  }

  async setResourceACL(resourceId, policy) {
    const pm = this._getPermissionManager();
    return pm.setResourceACL(resourceId, policy);
  }

  async getPermissionAudit(options) {
    const audit = new PermissionAudit(this.db);
    return audit.query(options);
  }

  async getDeniedPermissionStats() {
    const audit = new PermissionAudit(this.db);
    return audit.deniedStats();
  }

  // ──────────────────────────────────────
  // Phase 6.5: Agent System
  // ──────────────────────────────────────

  _getAgentEngine() {
    if (!this._agentEngine) {
      const registry = new AgentRegistry();
      const store = new AgentStore(this.db);

      this._agentEngine = new AgentEngine({
        registry,
        store,
        repository: this,
        workflowEngine: this._getWorkflowEngine ? this._getWorkflowEngine() : null,
        eventBus: this._getEventBus(),
        logger: this.logger || console
      });

      this._agentScheduler = new AgentScheduler({
        agentEngine: this._agentEngine,
        eventBus: this._getEventBus(),
        logger: this.logger || console
      });
    }
    return this._agentEngine;
  }

  async initAgentSystem() {
    const engine = this._getAgentEngine();

    // 注册内置 Agent
    if (engine.listAgents().length === 0) {
      await this._registerBuiltinAgents();
    }

    // 启动调度器
    this._agentScheduler.start();

    return engine;
  }

  async _registerBuiltinAgents() {
    const engine = this._getAgentEngine();

    // Knowledge Reviewer — 周期检查遗忘/孤立/断裂
    await engine.register(new Agent({
      id: 'knowledge-reviewer',
      name: 'Knowledge Reviewer',
      type: 'maintenance',
      description: '定期检查遗忘知识、孤立资源、断裂关系',
      capabilities: ['knowledge.analyze', 'resource.inspect', 'suggestion.create'],
      triggers: [{ type: 'schedule', schedule: { cron: 'weekly', time: '02:00' } }]
    }));

    // Knowledge Assistant — 资源创建时自动分析
    await engine.register(new Agent({
      id: 'knowledge-assistant',
      name: 'Knowledge Assistant',
      type: 'assistant',
      description: '监听资源创建，自动提取摘要、推荐关系、生成标签',
      capabilities: ['resource.inspect', 'suggestion.create', 'notification.send'],
      triggers: [{ type: 'event', event: 'resource.created' }]
    }));

    // Research Agent — 知识缺口发现
    await engine.register(new Agent({
      id: 'research-agent',
      name: 'Research Agent',
      type: 'research',
      description: '发现知识缺口，生成学习任务',
      capabilities: ['knowledge.analyze', 'graph.query', 'suggestion.create'],
      triggers: [{ type: 'schedule', schedule: { cron: 'daily', time: '09:00' } }]
    }));
  }

  async registerAgent(def) {
    const engine = this._getAgentEngine();
    const agent = new Agent(def);
    await engine.register(agent);
    return agent.toJSON();
  }

  async listAgents() {
    const engine = this._getAgentEngine();
    return engine.listAgents();
  }

  async startAgent(id) {
    const engine = this._getAgentEngine();
    return engine.start(id);
  }

  async stopAgent(id) {
    const engine = this._getAgentEngine();
    return engine.stop(id);
  }

  async executeAgent(id, options) {
    const engine = this._getAgentEngine();
    return engine.execute(id, options);
  }

  async getAgentRuns(agentId, limit) {
    const engine = this._getAgentEngine();
    return engine.getRuns(agentId, limit);
  }

  async getAgentMemory(agentId, limit) {
    const engine = this._getAgentEngine();
    return engine.getMemory(agentId, limit);
  }

  // ──────────────────────────────────────
  // Phase 6.6: Multi-Agent Collaboration
  // ──────────────────────────────────────

  _getCollaborationEngine() {
    if (!this._collaborationEngine) {
      const teamRegistry = new TeamRegistry();
      const memory = new CollaborationMemory(this.db);
      const messageBus = new MessageBus({ memory, eventBus: this._getEventBus() });
      const sharedMemory = new SharedMemory();

      this._collaborationEngine = new CollaborationEngine({
        teamRegistry,
        messageBus,
        sharedMemory,
        memory,
        agentEngine: this._agentEngine,
        eventBus: this._getEventBus(),
        logger: this.logger || console
      });
    }
    return this._collaborationEngine;
  }

  async initCollaborationSystem() {
    const engine = this._getCollaborationEngine();
    return engine;
  }

  async createAgentTeam(def) {
    const engine = this._getCollaborationEngine();
    return engine.createTeam(def);
  }

  async listAgentTeams() {
    const engine = this._getCollaborationEngine();
    return engine.listTeams();
  }

  async sendAgentMessage(from, to, type, payload) {
    const engine = this._getCollaborationEngine();
    return engine.sendMessage(from, to, type, payload);
  }

  async getAgentMessages(agentId, limit) {
    const engine = this._getCollaborationEngine();
    return engine.getMessages(agentId, limit);
  }

  async createAgentTask(teamId, goal) {
    const engine = this._getCollaborationEngine();
    return engine.createTask(teamId, goal);
  }

  async assignAgentTask(taskId) {
    const engine = this._getCollaborationEngine();
    return engine.assignTask(taskId);
  }

  async executeAgentTeam(teamId, goal) {
    const engine = this._getCollaborationEngine();
    return engine.executeTeam(teamId, goal);
  }

  async getSharedMemory(scope, type) {
    const engine = this._getCollaborationEngine();
    return engine.getSharedMemory(scope, type);
  }

  async getCollaborationHistory(teamId, limit) {
    const memory = new CollaborationMemory(this.db);
    return memory.listTasks(teamId, limit);
  }

  // ──────────────────────────────────────
  // Phase 6.7: AI Native Knowledge OS
  // ──────────────────────────────────────

  _getAIOS() {
    if (!this._aiOS) {
      this._aiOS = new AIOS({
        repository: this,
        graphEngine: this._getGraphEngine ? this._getGraphEngine() : null,
        agentEngine: this._getAgentEngine ? this._getAgentEngine() : null,
        workflowEngine: this._getWorkflowEngine ? this._getWorkflowEngine() : null,
        eventBus: this._getEventBus()
      });
    }
    return this._aiOS;
  }

  async initAIOS() {
    const aiOS = this._getAIOS();
    aiOS.start();
    return aiOS;
  }

  async askAI(input, options) {
    const aiOS = this._getAIOS();
    return aiOS.ask(input, options);
  }

  async analyzeKnowledge(input) {
    const aiOS = this._getAIOS();
    return aiOS.analyze(input);
  }

  async getAIInsights() {
    const aiOS = this._getAIOS();
    return aiOS.insights();
  }

  async getAIStatus() {
    const aiOS = this._getAIOS();
    const obs = await aiOS.observe();
    return {
      running: aiOS.running,
      memory: obs.memory,
      concepts: obs.concepts,
      learning: obs.learning
    };
  }

  // ──────────────────────────────────────
  // Phase 6.8: Knowledge OS Self-Evolution
  // ──────────────────────────────────────

  _getEvolutionEngine() {
    if (!this._evolutionEngine) {
      this._evolutionEngine = new EvolutionEngine({
        repository: this,
        graphEngine: this._getGraphEngine ? this._getGraphEngine() : null,
        agentEngine: this._getAgentEngine ? this._getAgentEngine() : null,
        workflowEngine: this._getWorkflowEngine ? this._getWorkflowEngine() : null,
        eventBus: this._getEventBus(),
        logger: this.logger || console
      });
    }
    return this._evolutionEngine;
  }

  async initEvolutionEngine() {
    const engine = this._getEvolutionEngine();
    engine.start();
    return engine;
  }

  async observeSystem() {
    const engine = this._getEvolutionEngine();
    return engine.observe();
  }

  async analyzeHealth() {
    const engine = this._getEvolutionEngine();
    const snapshot = await engine.observe();
    return engine.healthAnalyzer.analyze(snapshot);
  }

  async detectEvolution() {
    const engine = this._getEvolutionEngine();
    const snapshot = await engine.observe();
    const health = await engine.healthAnalyzer.analyze(snapshot);
    return engine.detector.detect(snapshot, health);
  }

  async generateEvolutionPlan() {
    const engine = this._getEvolutionEngine();
    const opportunities = await this.detectEvolution();
    const strategies = engine.strategy.generate(opportunities);
    return engine.planner.plan(strategies);
  }

  async executeEvolution() {
    const engine = this._getEvolutionEngine();
    return engine.evolve();
  }

  async getEvolutionHistory(limit) {
    const engine = this._getEvolutionEngine();
    return engine.history(limit);
  }

  async getEvolutionStatus() {
    const engine = this._getEvolutionEngine();
    return engine.status();
  }

  async rollbackEvolution() {
    const engine = this._getEvolutionEngine();
    return engine.rollback();
  }

  async exportGraph(format = 'json', options = {}) {
    const graph = await this.getGraph();
    const exporter = new GraphExporter(graph);
    switch (format) {
      case 'json':      return exporter.toJSON();
      case 'dot':       return exporter.toDOT(options);
      case 'mermaid':   return exporter.toMermaid(options);
      case 'adjacency': return exporter.toAdjacencyList();
      default: throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  // ──────────────────────────────────────

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
          await this.relationService.removeByTriple(rid, old.to_rid, 'wikilink');
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

    // 4. 按文件路径匹配（从 DB 中搜索，而非扫描目录）
    for (const r of all) {
      if (!r.path) continue;
      const basename = path.basename(r.path, path.extname(r.path));
      const ext = path.extname(r.path);
      // Target.md 或 YYYY-MM-DD-Target-xxxxxxxx.md
      if (basename === target || basename.endsWith('-' + target)) {
        return r.rid;
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
    
    // 检查是否属于 Container Source —— 容器内容由 sync engine 管理
    if (this.containerService) {
      const inSource = await this.containerService.isInContainerSource(filePath);
      if (inSource) {
        // 标记对应容器为 dirty（文件变更，等待 sync）
        await this._markContainersDirtyForFile(filePath);
        return;
      }
    }
    
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

  /**
   * 找到包含指定文件路径的 Container，标记为 dirty
   */
  async _markContainersDirtyForFile(filePath) {
    try {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const sources = await this.sourceService.getEnabledSources();
      for (const src of sources) {
        const normalizedSource = src.location.replace(/\\/g, '/');
        if (normalizedPath.startsWith(normalizedSource + '/') || normalizedPath === normalizedSource) {
          await this.syncEngine.markDirty(src.resource_rid);
        }
      }
    } catch (e) {
      // 静默失败，不影响 watcher 主流程
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