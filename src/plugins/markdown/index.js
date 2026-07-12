/**
 * Markdown Plugin — 内置示例插件
 *
 * Phase 6.1: 演示插件系统的标准集成方式。
 *
 * 能力:
 *   - 注册 markdown 资源类型
 *   - 统计 markdown 资源数量
 *   - 演示 Hook 使用
 */

const Plugin = require('../../plugin/plugin.cjs');

class MarkdownPlugin extends Plugin {
  manifest() {
    return {
      id: 'markdown',
      name: 'Markdown Plugin',
      version: '1.0.0',
      dependencies: [],
      contributes: {
        resourceTypes: ['markdown'],
        commands: ['markdown.export', 'markdown.stats'],
        exporters: ['markdown']
      }
    };
  }

  register(context) {
    this._context = context;

    // 注册 markdown 命令处理器
    const extRegistry = context.getExtensionRegistry();
    if (extRegistry) {
      extRegistry.register('markdown', 'commands', 'markdown.stats', {
        handler: 'markdownStats',
        pluginId: 'markdown'
      });
    }

    // 注册 Hook：资源创建后通知
    const hookMgr = context.getHookManager();
    if (hookMgr) {
      hookMgr.register('afterResourceCreate', async (payload) => {
        // 只处理 markdown 类型
        if (payload && payload.type === 'markdown') {
          context.logger.log(`[markdown] New markdown resource created: ${payload.rid}`);
        }
        return payload;
      }, { pluginId: 'markdown', priority: 5 });
    }
  }

  async initialize() {
    // 预加载或索引优化（当前为空操作）
  }

  async enable() {
    // 激活状态
  }

  async disable() {
    // 停用
  }

  async dispose() {
    // 清理
  }
}

module.exports = MarkdownPlugin;
