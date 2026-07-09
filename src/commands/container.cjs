const path = require('path');
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
// 公共工具
// ──────────────────────────────────────

async function _resolveContainerAndPath(repo, containerRid, absPath) {
  if (containerRid) {
    const container = await repo.getResource(containerRid);
    if (!container) {
      Logger.error(`容器不存在: ${containerRid}`);
      return null;
    }

    const sources = await repo.getResourceSources(containerRid);
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
  promote: promoteHandler
};
