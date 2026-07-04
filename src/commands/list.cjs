const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');
const StagingArea = require('../repo/staging.cjs');
const ResourceType = require('../utils/resourceType.cjs');
const HashUtils = require('../utils/hash.cjs');

module.exports = async function list(argv) {
  const { type, status, tag, category, limit, format } = argv;
  
  try {
    const repoPath = process.cwd();
    const repo = new Repository(repoPath);
    await repo.open();

    const staging = new StagingArea(repoPath);
    const stagingStatus = await staging.getStatus();
    const resourcesDir = path.join(repoPath, 'resources');
    
    if (!await fs.pathExists(resourcesDir)) {
      Logger.info('暂无资源');
      await repo.close();
      process.exit(0);
      return;
    }

    const dbResources = await repo.resourceService.getAll();
    const dbPaths = new Map(dbResources.map(r => [r.path, r]));

    const files = await fs.readdir(resourcesDir, { recursive: true });
    
    const allResources = [];

    for (const relPath of stagingStatus.added) {
      const absPath = path.join(resourcesDir, relPath);
      if (await fs.pathExists(absPath)) {
        const stats = await fs.stat(absPath);
        if (stats.isFile() && ResourceType.isSupported(absPath)) {
          const dbResource = dbPaths.get(absPath);
          const resourceStatus = dbResource ? '暂存修改' : '暂存新增';
          allResources.push({
            rid: dbResource ? dbResource.rid.substring(0, 12) + '...' : '(暂存)',
            type: ResourceType.fromPath(absPath) || 'note',
            path: absPath,
            metadata: dbResource ? dbResource.metadata : {
              title: path.basename(relPath, '.md'),
              tags: [],
              category: null
            },
            created: dbResource ? dbResource.created : stats.ctime.getTime(),
            updated: stats.mtime.getTime(),
            _status: resourceStatus
          });
        }
      }
    }

    for (const relPath of stagingStatus.deleted) {
      const absPath = path.join(resourcesDir, relPath);
      const dbResource = dbPaths.get(absPath);
      if (dbResource) {
        allResources.push({
          rid: dbResource.rid.substring(0, 12) + '...',
          type: dbResource.type,
          path: absPath,
          metadata: dbResource.metadata,
          created: dbResource.created,
          updated: dbResource.updated,
          _status: '暂存删除'
        });
      }
    }

    for (const file of files) {
      const absPath = path.join(resourcesDir, file);
      const stats = await fs.stat(absPath);
      
      if (!stats.isFile()) continue;
      if (!ResourceType.isSupported(absPath)) continue;
      
      const isInStaging = stagingStatus.added.includes(file) || 
                          stagingStatus.deleted.includes(file);
      
      if (dbPaths.has(absPath) && !isInStaging) {
        const dbResource = dbPaths.get(absPath);
        const currentHash = await HashUtils.fromFile(absPath, repo.cryptoKey);
        
        if (currentHash !== dbResource.hash) {
          allResources.push({
            rid: dbResource.rid.substring(0, 12) + '...',
            type: dbResource.type,
            path: absPath,
            metadata: dbResource.metadata,
            created: dbResource.created,
            updated: stats.mtime.getTime(),
            _status: '未暂存修改'
          });
        } else {
          allResources.push({
            rid: dbResource.rid.substring(0, 12) + '...',
            type: dbResource.type,
            path: absPath,
            metadata: dbResource.metadata,
            created: dbResource.created,
            updated: dbResource.updated,
            _status: '已提交'
          });
        }
      }
      
      if (!dbPaths.has(absPath) && !isInStaging) {
        allResources.push({
          rid: '(未跟踪)',
          type: ResourceType.fromPath(absPath) || 'note',
          path: absPath,
          metadata: {
            title: path.basename(file, '.md'),
            tags: [],
            category: null
          },
          created: stats.ctime.getTime(),
          updated: stats.mtime.getTime(),
          _status: '未跟踪'
        });
      }
    }

    for (const [absPath, dbResource] of dbPaths) {
      if (!await fs.pathExists(absPath)) {
        const relPath = path.relative(resourcesDir, absPath);
        if (!stagingStatus.deleted.includes(relPath)) {
          allResources.push({
            rid: dbResource.rid.substring(0, 12) + '...',
            type: dbResource.type,
            path: absPath,
            metadata: dbResource.metadata,
            created: dbResource.created,
            updated: dbResource.updated,
            _status: '未暂存删除'
          });
        }
      }
    }
    
    await repo.close();

    if (allResources.length === 0) {
      Logger.info('暂无资源');
      process.exit(0);
    }
    
    if (format === 'json') {
      console.log(JSON.stringify(allResources, null, 2));
      process.exit(0);
    }
    
    const getStatusLabel = (status) => {
      switch (status) {
        case '暂存新增': return chalk.green('新增');
        case '暂存修改': return chalk.blue('修改');
        case '暂存删除': return chalk.red('删除');
        case '未暂存修改': return chalk.yellow('修改');
        case '未暂存删除': return chalk.red('删除');
        case '未跟踪': return chalk.gray('未跟踪');
        default: return '';
      }
    };
    
    allResources.forEach(resource => {
      const title = resource.metadata.title || '未命名';
      const date = new Date(resource.created).toLocaleDateString();
      const statusLabel = getStatusLabel(resource._status);
      console.log(`${statusLabel} ${title} ${chalk.gray(date)}`);
    });
    
    process.exit(0);
    
  } catch (error) {
    Logger.error(`获取资源列表失败: ${error.message}`);
    process.exit(1);
  }
};