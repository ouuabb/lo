/**
 * EventRegistry — 事件注册表
 *
 * Phase 6.2: 管理事件定义（schema、描述）。
 *
 * 类似 ExtensionRegistry，但针对事件类型。
 *
 * 注册:
 *   type — domain.action
 *   description — 描述
 *   schema — payload schema（可选）
 */

class EventRegistry {
  constructor() {
    /** @type {Map<string, { type: string, description: string, schema?: object }>} */
    this._events = new Map();

    // 注册核心事件
    this._registerBuiltins();
  }

  /** 注册内置事件 */
  _registerBuiltins() {
    const builtins = [
      { type: 'resource.created', description: '资源创建' },
      { type: 'resource.updated', description: '资源更新' },
      { type: 'resource.deleted', description: '资源删除（软删除）' },
      { type: 'relation.created', description: '关系创建' },
      { type: 'relation.deleted', description: '关系删除' },
      { type: 'knowledge.analyzed', description: '知识分析完成' },
      { type: 'knowledge.repaired', description: '知识修复完成' },
      { type: 'knowledge.snapshot.created', description: '知识快照创建' },
      { type: 'ai.suggestion.created', description: 'AI 建议生成' },
      { type: 'ai.suggestion.approved', description: 'AI 建议被批准' },
      { type: 'sync.started', description: '同步开始' },
      { type: 'sync.finished', description: '同步完成' },
      { type: 'sync.conflict', description: '同步冲突' },
      { type: 'plugin.loaded', description: '插件加载' },
      { type: 'plugin.enabled', description: '插件启用' },
      { type: 'plugin.disabled', description: '插件禁用' },
      { type: 'automation.started', description: '自动化任务开始' },
      { type: 'automation.finished', description: '自动化任务完成' },
      { type: 'automation.suggestion.created', description: '自动化生成建议' },
      { type: 'workflow.started', description: '工作流开始' },
      { type: 'workflow.finished', description: '工作流完成' },
      { type: 'federation.repo_added', description: '联邦仓库添加' },
      { type: 'federation.repo_removed', description: '联邦仓库移除' },
    ];

    for (const b of builtins) {
      this._events.set(b.type, b);
    }
  }

  /**
   * 注册事件定义
   * @param {{ type: string, description: string, schema?: object }} def
   */
  register(def) {
    if (!def || !def.type) throw new Error('Event definition must have a type');
    if (this._events.has(def.type)) {
      throw new Error(`Event type '${def.type}' is already registered`);
    }
    this._events.set(def.type, {
      type: def.type,
      description: def.description || '',
      schema: def.schema || null
    });
  }

  /**
   * 获取事件定义
   */
  get(type) {
    return this._events.get(type) || null;
  }

  /**
   * 是否存在
   */
  has(type) {
    return this._events.has(type);
  }

  /**
   * 列出所有事件类型
   */
  list() {
    return Array.from(this._events.values());
  }

  /**
   * 按 domain 过滤
   */
  findByDomain(domain) {
    return Array.from(this._events.values())
      .filter(e => e.type.startsWith(domain + '.'));
  }

  /**
   * 列出所有 domain
   */
  domains() {
    const ds = new Set();
    for (const [type] of this._events) {
      ds.add(type.split('.')[0]);
    }
    return Array.from(ds);
  }
}

module.exports = EventRegistry;
