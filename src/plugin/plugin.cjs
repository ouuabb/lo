/**
 * Plugin — 插件基类
 *
 * Phase 6.1: 所有插件必须继承此类，实现标准生命周期接口。
 *
 * 生命周期:
 *   discover → load → register → initialize → enable → running → disable → dispose
 *
 * 子类必须实现:
 *   manifest()  — 返回插件声明 { id, name, version, dependencies?, contributes? }
 *   register()  — 注册扩展点
 *   initialize()— 初始化
 *
 * 可选实现:
 *   enable()
 *   disable()
 *   dispose()
 */

class Plugin {
  constructor() {
    this._state = 'created';
    this._context = null;
  }

  /**
   * 返回插件声明（metadata）
   * @returns {{ id: string, name: string, version: string, dependencies?: string[], contributes?: object }}
   */
  manifest() {
    throw new Error('Plugin.manifest() must be implemented');
  }

  /**
   * 注册扩展点（resourceTypes, commands, renderers 等）
   * @param {PluginContext} context
   */
  register(context) {
    throw new Error('Plugin.register() must be implemented');
  }

  /**
   * 初始化插件（此时所有依赖已加载）
   */
  async initialize() { }

  /**
   * 启用插件
   */
  async enable() { }

  /**
   * 禁用插件
   */
  async disable() { }

  /**
   * 销毁插件
   */
  async dispose() { }

  // ── 状态管理 ──

  get id() {
    return this.manifest().id || '';
  }

  get name() {
    return this.manifest().name || this.manifest().id;
  }

  get version() {
    return this.manifest().version || '0.0.0';
  }

  get state() {
    return this._state;
  }

  set state(val) {
    this._state = val;
  }

  get context() {
    return this._context;
  }

  set context(ctx) {
    this._context = ctx;
  }

  get dependencies() {
    return this.manifest().dependencies || [];
  }

  get contributes() {
    return this.manifest().contributes || {};
  }
}

module.exports = Plugin;
