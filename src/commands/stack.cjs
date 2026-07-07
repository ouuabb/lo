const chalk = require('chalk');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

function formatDate(ts) {
  return new Date(ts).toLocaleString('zh-CN');
}

function truncateRid(rid) {
  return rid.substring(0, 12) + '...';
}

module.exports = async function stack(argv) {
  const subcommand = argv.action || 'list';

  try {
    const repoPath = process.cwd();
    const repo = new Repository(repoPath);
    await repo.open();

    const rs = repo.resourceService;

    switch (subcommand) {
      case 'list': {
        // 列出所有在栈中的资源（layer >= 1）
        const all = await rs.getAll();
        const stacked = all.filter(r => r.layer >= 1);

        if (stacked.length === 0) {
          Logger.info('栈中没有资源');
          await repo.close();
          process.exit(0);
        }

        // 按 name 分组
        const groups = new Map();
        for (const r of stacked) {
          if (!groups.has(r.name)) {
            const active = await rs.getByName(r.name);
            groups.set(r.name, { active, stacked: [] });
          }
          groups.get(r.name).stacked.push(r);
        }

        for (const [name, group] of groups) {
          group.stacked.sort((a, b) => a.layer - b.layer);

          const activeStr = group.active
            ? `${chalk.green(group.active.type)} ${chalk.green.bold(group.active.rid.substring(0, 12) + '...')} ${group.active.path}`
            : '无活跃层';

          console.log(`${chalk.bold(name)} (活跃: ${activeStr})`);
          for (const r of group.stacked) {
            const title = r.metadata?.title || '(无标题)';
            console.log(`  [layer ${r.layer}] ${chalk.yellow(title)}  rid=${truncateRid(r.rid)}  ${chalk.gray(r.path)}  ${chalk.gray(formatDate(r.created))}`);
          }
          console.log('');
        }

        break;
      }

      case 'pop': {
        const name = argv.name;
        if (!name) {
          Logger.error('用法: lo stack pop <name>');
          process.exit(1);
        }

        const stack = await rs.getStack(name);
        if (stack.length < 2) {
          Logger.warn(`资源 "${name}" 没有栈层可弹出`);
          await repo.close();
          process.exit(0);
        }

        // 显示当前栈状态
        console.log(`${chalk.bold(name)} 当前栈: ${stack.map(r => `L${r.layer}(${truncateRid(r.rid)})`).join(' → ')}`);

        const newActive = await rs.popFromStack(name);
        const newStack = await rs.getStack(name);
        console.log(`${chalk.green('✓')} 弹出成功！`);
        console.log(`  新活跃: ${truncateRid(newActive.rid)} (${newActive.path})`);
        console.log(`  当前栈: ${newStack.map(r => `L${r.layer}(${truncateRid(r.rid)})`).join(' → ')}`);

        break;
      }

      case 'drop': {
        const name = argv.name;
        const layer = argv.layer;

        if (!name || layer == null) {
          Logger.error('用法: lo stack drop <name> <layer>');
          process.exit(1);
        }

        if (layer === 0) {
          Logger.error('不能丢弃活跃层 (layer=0)，请先 pop');
          process.exit(1);
        }

        const resource = await rs.getByNameLayer(name, layer);
        if (!resource) {
          Logger.error(`资源 "${name}" 不存在 layer ${layer}`);
          process.exit(1);
        }

        const result = await rs.dropLayer(name, layer);
        console.log(`${chalk.green('✓')} 已丢弃 ${name}[layer ${layer}] (rid: ${truncateRid(result.rid)})`);

        break;
      }

      default:
        Logger.error(`未知的子命令: ${subcommand}`);
        console.log('');
        console.log('lo stack <子命令>');
        console.log('  list                列出栈中所有资源');
        console.log('  pop  <name>         弹出栈顶，提升为活跃层');
        console.log('  drop <name> <layer> 丢弃指定栈层');
        process.exit(1);
    }

    await repo.close();
    process.exit(0);

  } catch (error) {
    Logger.error(`操作失败: ${error.message}`);
    process.exit(1);
  }
};
