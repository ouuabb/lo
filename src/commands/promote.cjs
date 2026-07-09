const path = require('path');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

/**
 * lo promote <path>
 *
 * 将容器中的文件成员提升为独立的 Resource。
 *
 * 提升后:
 *   - 文件拥有独立 RID
 *   - 可以参与 Relation
 *   - 可以添加标签、分类
 *   - 仍是容器的成员
 *
 * 示例:
 *   lo promote docs/design.md                          (自动查找所属容器)
 *   lo promote docs/design.md --container res_xxx       (指定容器)
 *   lo promote docs/design.md --type note               (指定类型)
 */
module.exports = async function promote(argv) {
  const memberPath = argv.path || argv._[1];
  const containerRid = argv.container || null;
  const type = argv.type || null;

  if (!memberPath) {
    Logger.error('请指定要提升的成员路径，例如: lo promote docs/design.md');
    process.exit(1);
    return;
  }

  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const absPath = path.isAbsolute(memberPath)
      ? memberPath
      : path.join(process.cwd(), memberPath);

    // 如果用户指定了容器 RID
    if (containerRid) {
      const container = await repo.getResource(containerRid);
      if (!container) {
        Logger.error(`容器不存在: ${containerRid}`);
        await repo.close();
        process.exit(1);
        return;
      }

      // 计算相对路径
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
        await repo.close();
        process.exit(1);
        return;
      }

      const resource = await repo.promoteMember(containerRid, relPath, {
        type,
        metadata: {}
      });

      Logger.success(`\n已提升为 Resource: ${memberPath}`);
      Logger.info(`  RID:      ${resource.rid}`);
      Logger.info(`  Type:     ${resource.type}`);
      Logger.info(`  Name:     ${resource.name}`);
      Logger.info(`  Container: ${container.name} (${containerRid})`);
    } else {
      // 自动查找所属容器
      // 策略：遍历所有有 container capability 的 Resource，
      // 检查内容来源是否包含该文件路径
      const allResources = await repo.resourceService.getAll();
      let foundContainer = null;
      let foundRelPath = null;

      for (const r of allResources) {
        const caps = r.capabilities || [];
        if (!caps.includes('container')) continue;

        const sources = await repo.getResourceSources(r.rid);
        for (const src of sources) {
          if (absPath.startsWith(src.location)) {
            foundContainer = r;
            foundRelPath = path.relative(src.location, absPath).replace(/\\/g, '/');
            break;
          }
        }
        if (foundContainer) break;
      }

      if (!foundContainer) {
        Logger.error(`未找到包含该文件的容器。请确保文件在某个容器的 Content Source 内。`);
        Logger.info('提示: 使用 --container <rid> 选项指定容器');
        await repo.close();
        process.exit(1);
        return;
      }

      const resource = await repo.promoteMember(foundContainer.rid, foundRelPath, {
        type,
        metadata: {}
      });

      Logger.success(`\n已提升为 Resource: ${memberPath}`);
      Logger.info(`  RID:        ${resource.rid}`);
      Logger.info(`  Type:       ${resource.type}`);
      Logger.info(`  Name:       ${resource.name}`);
      Logger.info(`  Container:  ${foundContainer.name} (${foundContainer.rid})`);
    }

    await repo.close();
    process.exit(0);

  } catch (error) {
    Logger.error(`提升失败: ${error.message}`);
    process.exit(1);
  }
};
