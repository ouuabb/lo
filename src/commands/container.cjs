const path = require('path');
const chalk = require('chalk');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

// ──────────────────────────────────────
// lo container promote <path>
// ──────────────────────────────────────

/**
 * 将容器成员提升为独立 Resource，或降级已提升的成员。
 *
 * 示例:
 *   lo container promote docs/design.md                    (提升)
 *   lo container promote docs/design.md --revert           (降级)
 *   lo container promote docs/design.md --container res_xx (指定容器)
 *   lo container promote docs/design.md --type note         (指定类型)
 */
async function promoteHandler(argv) {
  const memberPath = argv.path || argv._[2];
  const containerRid = argv.container || null;
  const type = argv.type || null;
  const revert = argv.revert || false;

  if (!memberPath) {
    const action = revert ? '降级' : '提升';
    Logger.error(`请指定要${action}的成员路径，例如: lo container promote docs/design.md${revert ? ' --revert' : ''}`);
    process.exit(1);
    return;
  }

  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const absPath = path.isAbsolute(memberPath)
      ? memberPath
      : path.join(process.cwd(), memberPath);

    const resolved = await _resolveContainerAndPath(repo, containerRid, absPath);
    if (!resolved) {
      await repo.close();
      process.exit(1);
      return;
    }

    const { container, relPath } = resolved;

    if (revert) {
      const result = await repo.demoteMember(container.rid, relPath);
      Logger.success(`\n已降级: ${memberPath}`);
      Logger.info(`  Container:    ${container.name} (${container.rid})`);
      Logger.info(`  原 Resource:  ${result.resource_rid}${result.resource_exists ? '' : ' (已删除)'}`);
    } else {
      const resource = await repo.promoteMember(container.rid, relPath, {
        type,
        metadata: {}
      });
      Logger.success(`\n已提升为 Resource: ${memberPath}`);
      Logger.info(`  RID:        ${resource.rid}`);
      Logger.info(`  Type:       ${resource.type}`);
      Logger.info(`  Name:       ${resource.name}`);
      Logger.info(`  Container:  ${container.name} (${container.rid})`);
    }

    await repo.close();
    process.exit(0);

  } catch (error) {
    const action = revert ? '降级' : '提升';
    Logger.error(`${action}失败: ${error.message}`);
    process.exit(1);
  }
}

// ──────────────────────────────────────
// lo container status <rid>
// ──────────────────────────────────────

/**
 * 显示容器内容变更状态（只读，不修改数据库）
 *
 * 对比文件系统与 container_members 表，
 * 展示新增、修改、删除的文件。
 *
 * 示例:
 *   lo container status res_xxx
 *   lo container status my-project
 */
async function statusHandler(argv) {
  const identifier = argv.rid || argv._[2];

  if (!identifier) {
    Logger.error('请指定容器（名称或 RID），例如: lo container status res_abc123');
    process.exit(1);
    return;
  }

  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const rid = await repo.resolveContainer(identifier);
    if (!rid) {
      Logger.error(`容器不存在或不是 Container: ${identifier}`);
      await repo.close();
      process.exit(1);
      return;
    }

    const container = await repo.getResource(rid);
    if (!container) {
      Logger.error(`容器不存在: ${rid}`);
      await repo.close();
      process.exit(1);
      return;
    }

    const diffList = await repo.getContainerDiff(rid);

    let totalAdded = 0;
    let totalModified = 0;
    let totalDeleted = 0;
    let totalUnchanged = 0;

    console.log(chalk.bold.cyan(`\n  Container: ${container.name} (${container.rid})`));
    console.log(chalk.gray(`  Type: ${container.type}`));
    console.log('');

    for (const diff of diffList) {
      console.log(chalk.bold(`  Content Source: ${diff.source}`));
      console.log(chalk.gray('  ' + '─'.repeat(55)));

      if (diff.added.length > 0) {
        console.log(chalk.green('\n    Added:'));
        for (const f of diff.added) {
          console.log(chalk.green(`      A  ${f.path}`));
        }
      }

      if (diff.modified.length > 0) {
        console.log(chalk.yellow('\n    Modified:'));
        for (const f of diff.modified) {
          const promoted = f.resource_rid ? chalk.magenta(' [已提升]') : '';
          console.log(chalk.yellow(`      M  ${f.path}${promoted}`));
        }
      }

      if (diff.deleted.length > 0) {
        console.log(chalk.red('\n    Deleted:'));
        for (const f of diff.deleted) {
          const promoted = f.resource_rid ? chalk.magenta(' [已提升]') : '';
          console.log(chalk.red(`      D  ${f.path}${promoted}`));
        }
      }

      totalAdded += diff.added.length;
      totalModified += diff.modified.length;
      totalDeleted += diff.deleted.length;
      totalUnchanged += diff.unchanged;
    }

    // 汇总
    console.log(chalk.gray('\n  ' + '─'.repeat(55)));
    const summaryParts = [];
    if (totalAdded > 0) summaryParts.push(chalk.green(`${totalAdded} 新增`));
    if (totalModified > 0) summaryParts.push(chalk.yellow(`${totalModified} 修改`));
    if (totalDeleted > 0) summaryParts.push(chalk.red(`${totalDeleted} 删除`));
    if (summaryParts.length === 0) {
      console.log(chalk.gray(`  无变更 (${totalUnchanged} 个文件未变化)`));
    } else {
      console.log(`  ${summaryParts.join(', ')}${chalk.gray(`, ${totalUnchanged} 未变化`)}`);
    }

    if (totalAdded + totalModified + totalDeleted > 0) {
      console.log(chalk.gray('\n  提示: 执行 lo container scan ' + rid + ' 应用变更'));
    }

    console.log('');
    await repo.close();
    process.exit(0);

  } catch (error) {
    Logger.error(`status 失败: ${error.message}`);
    process.exit(1);
  }
}

// ──────────────────────────────────────
// lo container scan <rid>
// ──────────────────────────────────────

/**
 * 同步容器成员：扫描 Content Source 目录，
 * 将文件系统变化（新增/修改/删除）应用到 container_members 表。
 *
 * 示例:
 *   lo container scan res_xxx
 *   lo container scan my-project
 */
async function scanHandler(argv) {
  const identifier = argv.rid || argv._[2];

  if (!identifier) {
    Logger.error('请指定容器（名称或 RID），例如: lo container scan res_abc123');
    process.exit(1);
    return;
  }

  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const rid = await repo.resolveContainer(identifier);
    if (!rid) {
      Logger.error(`容器不存在或不是 Container: ${identifier}`);
      await repo.close();
      process.exit(1);
      return;
    }

    const container = await repo.getResource(rid);
    if (!container) {
      Logger.error(`容器不存在: ${rid}`);
      await repo.close();
      process.exit(1);
      return;
    }

    console.log(chalk.bold.cyan(`\n  Container: ${container.name} (${container.rid})`));

    const results = await repo.syncContainerMembers(rid);

    let totalAdded = 0;
    let totalUpdated = 0;
    let totalRemoved = 0;

    for (const r of results) {
      console.log(chalk.gray(`\n  Source: ${r.source}`));

      if (r.added > 0) console.log(chalk.green(`    +${r.added} 新增`));
      if (r.updated > 0) console.log(chalk.yellow(`    ~${r.updated} 更新`));
      if (r.removed > 0) console.log(chalk.red(`    -${r.removed} 移除`));

      if (r.errors && r.errors.length > 0) {
        for (const e of r.errors) {
          console.log(chalk.red(`    ! ${e.file}: ${e.error}`));
        }
      }

      totalAdded += r.added;
      totalUpdated += r.updated;
      totalRemoved += r.removed;
    }

    console.log(chalk.gray('\n  ' + '─'.repeat(55)));
    if (totalAdded + totalUpdated + totalRemoved === 0) {
      Logger.success('  已是最新，无需同步');
    } else {
      Logger.success(`  同步完成: ${totalAdded ? '+' + totalAdded : ''}${totalUpdated ? ' ~' + totalUpdated : ''}${totalRemoved ? ' -' + totalRemoved : ''}`);
    }

    // 显示统计
    const stats = await repo.getContainerMemberStats(rid);
    console.log(chalk.gray(`  总计 ${stats.total} 个成员 (${stats.promoted} 已提升, ${stats.indexed} 普通文件, ${stats.deleted} 已删除)`));

    console.log('');
    await repo.close();
    process.exit(0);

  } catch (error) {
    Logger.error(`scan 失败: ${error.message}`);
    process.exit(1);
  }
}

// ──────────────────────────────────────
// lo container list <rid>
// ──────────────────────────────────────

/**
 * 列出容器的所有成员。
 *
 * 示例:
 *   lo container list res_xxx
 *   lo container list my-project
 *   lo container list res_xxx --resources    (仅列出已提升的)
 *   lo container list res_xxx --files         (仅列出未提升的)
 */
async function listHandler(argv) {
  const identifier = argv.rid || argv._[2];
  const resourceOnly = argv.resources || false;
  const fileOnly = argv.files || false;

  if (!identifier) {
    Logger.error('请指定容器（名称或 RID），例如: lo container list res_abc123');
    process.exit(1);
    return;
  }

  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const rid = await repo.resolveContainer(identifier);
    if (!rid) {
      Logger.error(`容器不存在或不是 Container: ${identifier}`);
      await repo.close();
      process.exit(1);
      return;
    }

    const container = await repo.getResource(rid);
    if (!container) {
      Logger.error(`容器不存在: ${rid}`);
      await repo.close();
      process.exit(1);
      return;
    }

    const members = await repo.getContainerMembers(rid, { resourceOnly, fileOnly });

    console.log(chalk.bold.cyan(`\n  Container: ${container.name} (${container.rid})`));
    console.log(chalk.gray(`  Type: ${container.type}`));
    console.log(chalk.gray(`  ${members.length} 个成员`));
    console.log('');

    if (members.length === 0) {
      console.log(chalk.gray('  (空)'));
    } else {
      for (const m of members) {
        let icon, statusText;
        if (m.status === 'promoted') {
          icon = chalk.magenta('R');
          statusText = chalk.magenta(` ${m.resource_rid}`);
        } else if (m.status === 'deleted') {
          icon = chalk.red('D');
          statusText = chalk.red(' (已删除)');
        } else if (m.status === 'ignored') {
          icon = chalk.gray('I');
          statusText = chalk.gray(' (已忽略)');
        } else {
          icon = chalk.gray('F');
          statusText = '';
        }
        console.log(`  ${icon} ${m.path}${statusText}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);

  } catch (error) {
    Logger.error(`list 失败: ${error.message}`);
    process.exit(1);
  }
}

// ──────────────────────────────────────
// lo container ignore <path>
// ──────────────────────────────────────

/**
 * 忽略容器成员（从索引中排除，不删除记录）
 *
 * 示例:
 *   lo container ignore docs/secret.md
 *   lo container ignore docs/secret.md -c my-project
 */
async function ignoreHandler(argv) {
  const memberPath = argv.path || argv._[2];
  const containerIdentifier = argv.container || argv.c || null;

  if (!memberPath) {
    Logger.error('请指定要忽略的成员路径，例如: lo container ignore docs/secret.md');
    process.exit(1);
    return;
  }

  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const absPath = path.isAbsolute(memberPath)
      ? memberPath
      : path.join(process.cwd(), memberPath);

    const resolved = await _resolveContainerAndPath(repo, containerIdentifier, absPath);
    if (!resolved) {
      await repo.close();
      process.exit(1);
      return;
    }

    const result = await repo.ignoreContainerMember(resolved.container.rid, resolved.relPath);
    Logger.success(`已忽略: ${memberPath}`);
    Logger.info(`  Container: ${resolved.container.name} (${resolved.container.rid})`);
    Logger.info('  提示: 使用 lo container unignore <path> 取消忽略');

    await repo.close();
    process.exit(0);

  } catch (error) {
    Logger.error(`ignore 失败: ${error.message}`);
    process.exit(1);
  }
}

// ──────────────────────────────────────
// lo container unignore <path>
// ──────────────────────────────────────

/**
 * 取消忽略容器成员
 *
 * 示例:
 *   lo container unignore docs/secret.md
 */
async function unignoreHandler(argv) {
  const memberPath = argv.path || argv._[2];
  const containerIdentifier = argv.container || argv.c || null;

  if (!memberPath) {
    Logger.error('请指定要取消忽略的成员路径，例如: lo container unignore docs/secret.md');
    process.exit(1);
    return;
  }

  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const absPath = path.isAbsolute(memberPath)
      ? memberPath
      : path.join(process.cwd(), memberPath);

    const resolved = await _resolveContainerAndPath(repo, containerIdentifier, absPath);
    if (!resolved) {
      await repo.close();
      process.exit(1);
      return;
    }

    const result = await repo.unignoreContainerMember(resolved.container.rid, resolved.relPath);
    Logger.success(`已取消忽略: ${memberPath}`);
    Logger.info(`  Container: ${resolved.container.name} (${resolved.container.rid})`);

    await repo.close();
    process.exit(0);

  } catch (error) {
    Logger.error(`unignore 失败: ${error.message}`);
    process.exit(1);
  }
}

// ──────────────────────────────────────
// 公共工具
// ──────────────────────────────────────

async function _resolveContainerAndPath(repo, containerIdentifier, absPath) {
  if (containerIdentifier) {
    const rid = await repo.resolveContainer(containerIdentifier);
    if (!rid) {
      Logger.error(`容器不存在或不是 Container: ${containerIdentifier}`);
      return null;
    }

    const container = await repo.getResource(rid);
    const sources = await repo.getResourceSources(rid);
    let relPath = null;
    for (const src of sources) {
      if (absPath.startsWith(src.location)) {
        relPath = path.relative(src.location, absPath).replace(/\\/g, '/');
        break;
      }
    }

    if (!relPath) {
      Logger.error(`文件不在容器的 Content Source 内: ${absPath}`);
      Logger.info(`容器 "${container.name}" 的源: ${sources.map(s => s.location).join(', ')}`);
      return null;
    }

    return { container, relPath };
  }

  // 自动查找所属容器
  const allResources = await repo.resourceService.getAll();
  for (const r of allResources) {
    const caps = r.capabilities || [];
    if (!caps.includes('container')) continue;

    const sources = await repo.getResourceSources(r.rid);
    for (const src of sources) {
      if (absPath.startsWith(src.location)) {
        return {
          container: r,
          relPath: path.relative(src.location, absPath).replace(/\\/g, '/')
        };
      }
    }
  }

  Logger.error('未找到包含该文件的容器。请确保文件在某个容器的 Content Source 内。');
  Logger.info('提示: 使用 --container <rid> 选项指定容器');
  return null;
}

// ──────────────────────────────────────
// 导出
// ──────────────────────────────────────

module.exports = {
  promote: promoteHandler,
  status: statusHandler,
  scan: scanHandler,
  list: listHandler,
  ignore: ignoreHandler,
  unignore: unignoreHandler
};
