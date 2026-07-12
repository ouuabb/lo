/**
 * PluginLoader — 插件加载器
 *
 * Phase 6.1: 负责发现和加载插件。
 *
 * 流程:
 *   scan plugins/ → read manifest → require() → instantiate Plugin
 *
 * 支持来源（当前）:
 *   - src/plugins/ 目录下的内置插件
 *
 * 未来支持:
 *   - npm / zip / git / remote
 */

const path = require('path');
const fs = require('fs-extra');
const Plugin = require('./plugin.cjs');

class PluginLoader {
  /**
   * @param {string} pluginsDir — 插件目录绝对路径
   */
  constructor(pluginsDir) {
    this.pluginsDir = pluginsDir;
  }

  /**
   * 扫描并加载所有插件
   * @returns {Promise<Plugin[]>}
   */
  async loadAll() {
    const plugins = [];

    if (!await fs.pathExists(this.pluginsDir)) {
      return plugins;
    }

    const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // 跳过非插件目录（点开头的隐藏目录）
      if (entry.name.startsWith('.')) continue;

      const pluginDir = path.join(this.pluginsDir, entry.name);

      try {
        const plugin = await this.load(pluginDir);
        if (plugin) {
          plugins.push(plugin);
        }
      } catch (e) {
        console.error(`[plugin] Failed to load '${entry.name}': ${e.message}`);
      }
    }

    return plugins;
  }

  /**
   * 加载单个插件
   * @param {string} pluginDir — 插件目录路径
   * @returns {Promise<Plugin|null>}
   */
  async load(pluginDir) {
    // 1. 读取 manifest
    const manifestPath = path.join(pluginDir, 'plugin.json');
    if (!await fs.pathExists(manifestPath)) {
      console.error(`[plugin] Missing plugin.json in ${pluginDir}`);
      return null;
    }

    let manifest;
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    } catch (e) {
      throw new Error(`Invalid plugin.json: ${e.message}`);
    }

    if (!manifest.id || !manifest.name) {
      throw new Error('Plugin manifest must have id and name');
    }

    // 2. 找入口文件
    const mainFile = manifest.main || 'index.js';
    const mainPath = path.join(pluginDir, mainFile);

    if (!await fs.pathExists(mainPath)) {
      throw new Error(`Plugin entry file not found: ${mainFile}`);
    }

    // 3. require 入口
    const PluginClass = require(mainPath);

    if (!PluginClass || typeof PluginClass !== 'function') {
      throw new Error('Plugin entry must export a class');
    }

    // 4. 实例化
    const plugin = new PluginClass();

    if (!(plugin instanceof Plugin)) {
      throw new Error('Plugin must extend base Plugin class');
    }

    // 5. 验证 manifest 一致性
    const declared = plugin.manifest();
    if (declared.id !== manifest.id) {
      console.warn(`[plugin] manifest id mismatch: ${manifest.id} vs ${declared.id}`);
    }

    return plugin;
  }

  /**
   * 检查插件依赖是否满足
   * @param {Plugin} plugin
   * @param {Map<string, Plugin>} loadedPlugins
   * @returns {{ satisfied: boolean, missing: string[] }}
   */
  checkDependencies(plugin, loadedPlugins) {
    const deps = plugin.dependencies;
    const missing = [];

    for (const depId of deps) {
      if (!loadedPlugins.has(depId)) {
        missing.push(depId);
      }
    }

    return {
      satisfied: missing.length === 0,
      missing
    };
  }

  /**
   * 检测循环依赖
   * @param {Map<string, Plugin>} plugins
   * @returns {string[]} 循环链
   */
  detectCycles(plugins) {
    const visited = new Set();
    const recStack = new Set();
    const cycle = [];

    function dfs(id) {
      if (recStack.has(id)) {
        cycle.push(id);
        return true;
      }
      if (visited.has(id)) return false;

      visited.add(id);
      recStack.add(id);

      const plugin = plugins.get(id);
      if (plugin) {
        for (const depId of plugin.dependencies) {
          if (dfs(depId)) {
            cycle.push(id);
            return true;
          }
        }
      }

      recStack.delete(id);
      return false;
    }

    for (const [id] of plugins) {
      if (dfs(id)) {
        return cycle.reverse();
      }
    }

    return [];
  }

  /**
   * 拓扑排序，确保加载顺序
   * @param {Map<string, Plugin>} plugins
   * @returns {string[]} 排序后的 plugin ID 列表
   */
  topologicalSort(plugins) {
    const inDegree = new Map();
    const adjList = new Map();

    for (const [id] of plugins) {
      inDegree.set(id, 0);
      adjList.set(id, []);
    }

    for (const [id, plugin] of plugins) {
      for (const depId of plugin.dependencies) {
        adjList.get(depId).push(id);
        inDegree.set(id, inDegree.get(id) + 1);
      }
    }

    const queue = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted = [];
    while (queue.length > 0) {
      const id = queue.shift();
      sorted.push(id);

      for (const neighbor of adjList.get(id)) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    return sorted;
  }
}

module.exports = PluginLoader;
