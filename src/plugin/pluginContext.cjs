/**
 * PluginContext — 插件上下文
 *
 * Phase 6.1: 插件只能通过 Context 访问系统能力，不能直接访问 Repository。
 *
 * 提供的服务（按需注入）:
 *   repository    — Repository 实例
 *   logger        — 日志
 *   config        — 配置
 *   extensionRegistry — 扩展注册表
 *   hookManager   — Hook 管理
 *   cache         — 缓存（后续）
 */

class PluginContext {
  /**
   * @param {object} services
   * @param {object} [services.repository]
   * @param {object} [services.logger]
   * @param {object} [services.config]
   * @param {object} [services.extensionRegistry]
   * @param {object} [services.hookManager]
   */
  constructor(services = {}) {
    this.repository = services.repository || null;
    this.logger = services.logger || console;
    this.config = services.config || {};
    this.extensionRegistry = services.extensionRegistry || null;
    this.hookManager = services.hookManager || null;
    this.cache = services.cache || null;
  }

  /**
   * 获取 Repository
   */
  getRepository() {
    if (!this.repository) {
      throw new Error('Repository not available in plugin context');
    }
    return this.repository;
  }

  /**
   * 获取配置
   */
  getConfig(key, defaultValue) {
    if (!this.config) return defaultValue;
    return key ? (this.config[key] !== undefined ? this.config[key] : defaultValue) : this.config;
  }

  /**
   * 获取扩展注册表
   */
  getExtensionRegistry() {
    if (!this.extensionRegistry) {
      throw new Error('ExtensionRegistry not available in plugin context');
    }
    return this.extensionRegistry;
  }

  /**
   * 获取 Hook 管理器
   */
  getHookManager() {
    if (!this.hookManager) {
      throw new Error('HookManager not available in plugin context');
    }
    return this.hookManager;
  }
}

module.exports = PluginContext;
