const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  插件系统（Phase 6.1）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.bold.yellow('\n  一、概述'));
    console.log(`
  lo 插件系统提供可扩展的模块化能力，允许第三方开发者为 lo 添加
  新功能而无需修改核心代码。插件通过标准化的生命周期管理和扩展点
  机制与核心系统交互。

  核心组件：
    - PluginManager    — 插件加载、卸载、生命周期管理
    - PluginLoader     — 从文件系统发现和加载插件
    - PluginRegistry   — 插件注册表，管理扩展点
    - HookSystem       — 钩子系统，插件可注册回调
    - ExtensionPoint   — 扩展点定义，插件可实现接口
    - ContextIsolation — 上下文隔离，插件间互不影响`);

    console.log(chalk.bold.yellow('\n  二、插件生命周期'));
    console.log(`
  每个插件经过以下生命周期阶段：

    load → initialize → activate → (running) → deactivate → unload

  1. load:        从磁盘加载插件代码，验证 manifest
  2. initialize:  调用插件的 onInit()，注入依赖
  3. activate:    调用插件的 onActivate()，注册扩展点
  4. running:     插件正常运行，响应事件
  5. deactivate:  调用插件的 onDeactivate()，清理扩展点
  6. unload:      从内存中卸载插件代码

  CLI 管理命令：
    lo plugin list       — 列出已加载插件
    lo plugin enable id  — 启用插件
    lo plugin disable id — 禁用插件（保持加载但暂停）
    lo plugin reload id  — 重载插件（deactivate → unload → load → activate）
    lo plugin info id    — 查看插件详情`);

    console.log(chalk.bold.yellow('\n  三、扩展点'));
    console.log(`
  插件通过实现扩展点来添加功能：

  扩展类型          说明
  ────────────────  ──────────────────────────────────
  hook              生命周期钩子回调
  route             注册 HTTP API 路由
  command           注册 CLI 子命令
  transformer       内容转换器（导入/导出/渲染）
  validator         自定义校验器
  storage           自定义存储后端
  indexer           自定义索引器

  插件在 manifest.json 中声明其实现的扩展点类型。`);

    console.log(chalk.bold.yellow('\n  四、上下文隔离'));
    console.log(`
  每个插件运行在独立的上下文中，确保插件间互不影响：

    - 插件 crash 不会导致核心崩溃
    - 插件间不能直接访问彼此的状态
    - 插件通过事件总线进行通信（而非直接调用）
    - 插件只能访问通过依赖注入提供的 API`);

    console.log(chalk.gray('\n  相关命令：'));
    console.log(chalk.gray('    lo plugin list/enable/disable/reload/info'));
    console.log(chalk.gray('    lo event       — 事件总线'));
    console.log(chalk.gray('    lo manual plugin'));
    console.log('');
};
