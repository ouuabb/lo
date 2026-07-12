/**
 * PluginManager — 插件系统中枢
 *
 * Phase 6.1: 统一管理所有子系统的入口。
 *
 * 对外 API:
 *   discoverPlugins()   — 扫描并加载所有插件
 *   loadPlugin(id)     — 加载指定插件
 *   unloadPlugin(id)   — 卸载
 *   enablePlugin(id)   — 启用
 *   disablePlugin(id)  — 禁用
 *   reloadPlugin(id)   — 重载
 *   listPlugins()      — 列出
 *   getPlugin(id)      — 获取插件实例
 *   installPlugin()    — 安装（未来）
 */

const path = require('path');
const PluginLoader = require('./pluginLoader.cjs');
const PluginRegistry = require('./pluginRegistry.cjs');
const ExtensionRegistry = require('./extensionRegistry.cjs');
const HookManager = require('./hookManager.cjs');
const LifecycleManager = require('./lifecycleManager.cjs');
const PluginContext = require('./pluginContext.cjs');

class PluginManager {
  /**
   * @param {object} options
   * @param {string} options.pluginsDir — 插件目录
   * @param {object} [options.repository] — Repository 实例
   * @param {object} [options.logger] — 日志
   * @param {object} [options.db] — 数据库（用于持久化插件状态）
   */
  constructor(options = {}) {
    this.pluginsDir = options.pluginsDir || path.join(process.cwd(), 'src', 'plugins');

    // 子系统
    this.loader = new PluginLoader(this.pluginsDir);
    this.registry = new PluginRegistry();
    this.extensions = new ExtensionRegistry();
    this.hooks = new HookManager();
    this.lifecycle = new LifecycleManager();

    // Context 服务
    this._baseServices = {
      repository: options.repository || null,
      logger: options.logger || console,
      extensionRegistry: this.extensions,
      hookManager: this.hooks,
      eventBus: options.eventBus || null
    };

    // 数据库（用于持久化状态）
    this.db = options.db || null;

    /** @type {Map<string, PluginContext>} pluginId → context */
    this._contexts = new Map();
  }

  // ── 生命周期编排 ──

  /**
   * 初始化：扫描并加载所有插件
   */
  async initialize() {
    const plugins = await this.loader.loadAll();

    // 构建 plugin map 用于依赖检测
    const pluginMap = new Map();
    for (const p of plugins) {
      pluginMap.set(p.id, p);
    }

    // 循环依赖检测
    const cycles = this.loader.detectCycles(pluginMap);
    if (cycles.length > 0) {
      throw new Error(`Circular dependency detected: ${cycles.join(' → ')}`);
    }

    // 拓扑排序
    const sortedIds = this.loader.topologicalSort(pluginMap);

    // 按序注册和初始化
    for (const id of sortedIds) {
      const plugin = pluginMap.get(id);
      await this._activatePlugin(plugin);
    }

    // 持久化到 DB
    await this._savePluginStates();
  }

  /**
   * 加载单个插件
   */
  async loadPlugin(pluginPath) {
    const plugin = await this.loader.load(pluginPath);
    if (!plugin) throw new Error(`Failed to load plugin from ${pluginPath}`);
    await this._activatePlugin(plugin);
    return plugin;
  }

  /**
   * 卸载插件
   */
  async unloadPlugin(id) {
    const plugin = this.registry.get(id);
    if (!plugin) throw new Error(`Plugin '${id}' not found`);

    // 禁用 → 销毁
    if (this.lifecycle.isEnabled(id)) {
      await this._transition(id, 'disabled', () => plugin.disable());
    }

    await this._transition(id, 'disposed', () => plugin.dispose());

    // 清理注册
    this.extensions.unregisterAll(id);
    this.hooks.unregisterAll(id);
    this.registry.unregister(id);
    this.lifecycle.remove(id);
    this._contexts.delete(id);

    await this._deletePluginState(id);
  }

  /**
   * 启用插件
   */
  async enablePlugin(id) {
    const plugin = this.registry.get(id);
    if (!plugin) throw new Error(`Plugin '${id}' not found`);

    const current = this.lifecycle.getState(id);
    if (current === 'enabled') return; // already enabled

    if (current === 'disabled') {
      await this._transition(id, 'enabled', () => plugin.enable());
    } else if (current === 'initialized') {
      await this._transition(id, 'enabled', () => plugin.enable());
    }

    await this._savePluginStates();
  }

  /**
   * 禁用插件
   */
  async disablePlugin(id) {
    const plugin = this.registry.get(id);
    if (!plugin) throw new Error(`Plugin '${id}' not found`);

    if (this.lifecycle.isEnabled(id)) {
      await this._transition(id, 'disabled', () => plugin.disable());
      await this._savePluginStates();
    }
  }

  /**
   * 重载插件
   */
  async reloadPlugin(id) {
    const plugin = this.registry.get(id);
    if (!plugin) throw new Error(`Plugin '${id}' not found`);

    // 保存路径信息
    const pluginDir = plugin._pluginDir;
    if (!pluginDir) throw new Error(`Cannot reload: plugin directory unknown`);

    // 卸载
    await this.unloadPlugin(id);

    // 重新加载
    return this.loadPlugin(pluginDir);
  }

  // ── 查询 ──

  listPlugins() {
    return this.registry.list();
  }

  getPlugin(id) {
    return this.registry.get(id);
  }

  /**
   * 获取扩展注册表
   */
  getExtensionRegistry() {
    return this.extensions;
  }

  /**
   * 获取 Hook 管理器
   */
  getHookManager() {
    return this.hooks;
  }

  // ── 内部方法 ──

  /**
   * 激活插件：注册 → 初始化 → 启用
   */
  async _activatePlugin(plugin) {
    const id = plugin.id;

    // 创建 Context
    const context = new PluginContext(this._baseServices);
    plugin.context = context;
    this._contexts.set(id, context);

    // 注册到 Registry
    this.registry.register(plugin);

    // 生命周期：loaded
    this.lifecycle.setState(id, 'loaded');
    plugin.state = 'loaded';

    // 注册扩展点
    plugin.register(context);
    this.extensions.registerAll(id, plugin.contributes);

    // 初始化
    this.lifecycle.setState(id, 'initialized');
    plugin.state = 'initialized';
    await plugin.initialize();

    // 自动启用
    await this._transition(id, 'enabled', () => plugin.enable());
  }

  /**
   * 状态转换辅助
   */
  async _transition(id, targetState, action) {
    try {
      if (action) await action();
    } catch (e) {
      console.error(`[plugin] Transition failed for '${id}' → ${targetState}: ${e.message}`);
      throw e;
    }
    this.lifecycle.setState(id, targetState);

    // 同步到 Plugin 对象
    const plugin = this.registry.get(id);
    if (plugin) {
      plugin.state = targetState;
    }
  }

  /**
   * 持久化插件状态到 DB
   */
  async _savePluginStates() {
    if (!this.db) return;

    for (const plugin of this.registry.plugins) {
      const state = this.lifecycle.getState(plugin.id);
      const enabled = state === 'enabled' ? 1 : 0;

      try {
        await this.db.run(
          `INSERT OR REPLACE INTO plugins (id, name, version, enabled, installed_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [plugin.id, plugin.name, plugin.version, enabled, Date.now(), Date.now()]
        );
      } catch {}
    }
  }

  /**
   * 删除插件持久化记录
   */
  async _deletePluginState(id) {
    if (!this.db) return;
    try {
      await this.db.run('DELETE FROM plugins WHERE id = ?', [id]);
    } catch {}
  }
}

module.exports = PluginManager;
