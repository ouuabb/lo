const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const Repository = require('../repo/repository.cjs');
const StagingArea = require('../repo/staging.cjs');
const ResourceType = require('../utils/resourceType.cjs');
const HashUtils = require('../utils/hash.cjs');

async function status(argv) {
  const repoPath = argv.path || process.cwd();
  
  const repo = new Repository(repoPath);
  await repo.open();
  
  const staging = new StagingArea(repoPath);
  const stagingStatus = await staging.getStatus();
  const resourcesDir = path.join(repoPath, 'resources');
  
  if (!await fs.pathExists(resourcesDir)) {
    console.log(chalk.yellow('resources 目录不存在'));
    await repo.close();
    return;
  }

  const dbResources = await repo.resourceService.getAll();
  const dbPaths = new Map(dbResources.map(r => [r.path, r]));

  const files = await fs.readdir(resourcesDir, { recursive: true });
  
  const staged = { added: [], modified: [], deleted: [], renamed: [] };
  const unstaged = { modified: [], deleted: [], renamed: [] };
  const untracked = [];

  for (const relPath of stagingStatus.added) {
    const absPath = path.join(resourcesDir, relPath);
    if (await fs.pathExists(absPath)) {
      if (dbPaths.has(absPath)) {
        staged.modified.push(relPath);
      } else {
        staged.added.push(relPath);
      }
    }
  }

  for (const relPath of stagingStatus.modified) {
    const absPath = path.join(resourcesDir, relPath);
    if (await fs.pathExists(absPath) && dbPaths.has(absPath)) {
      staged.modified.push(relPath);
    }
  }

  for (const relPath of stagingStatus.deleted) {
    staged.deleted.push(relPath);
  }

  for (const rename of stagingStatus.renamed) {
    staged.renamed.push(rename);
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
        unstaged.modified.push(file);
      }
    }
    
    if (!dbPaths.has(absPath) && !isInStaging) {
      untracked.push(file);
    }
  }

  for (const [absPath, resource] of dbPaths) {
    if (!await fs.pathExists(absPath)) {
      const relPath = path.relative(resourcesDir, absPath);
      if (!stagingStatus.deleted.includes(relPath)) {
        unstaged.deleted.push(relPath);
      }
    }
  }

  // 自动检测重命名：匹配"删除"文件的 hash 与"未跟踪"文件的 hash
  const actualUntracked = [];
  const actualDeleted = [];
  const renameDetections = [];

  if (unstaged.deleted.length > 0 && untracked.length > 0) {
    const untrackedHashes = new Map();
    for (const uf of untracked) {
      const absPath = path.join(resourcesDir, uf);
      untrackedHashes.set(uf, await HashUtils.fromFile(absPath, repo.cryptoKey));
    }

    for (const delRel of unstaged.deleted) {
      const delAbs = path.join(resourcesDir, delRel);
      const dbResource = dbPaths.get(delAbs);
      if (!dbResource) {
        actualDeleted.push(delRel);
        continue;
      }

      let matched = false;
      for (const [uf, ufHash] of untrackedHashes) {
        if (ufHash === dbResource.hash) {
          renameDetections.push({ old: delRel, new: uf });
          untrackedHashes.delete(uf);
          matched = true;
          break;
        }
      }
      if (!matched) {
        actualDeleted.push(delRel);
      }
    }

    unstaged.deleted = actualDeleted;

    for (const [uf] of untrackedHashes) {
      actualUntracked.push(uf);
    }
  } else {
    actualUntracked.push(...untracked);
  }
  unstaged.renamed = renameDetections;

  console.log(chalk.bold('\n工作区状态'));
  console.log('----------------');

  if (stagingStatus.added.length > 0 || stagingStatus.modified.length > 0 || stagingStatus.deleted.length > 0 || stagingStatus.renamed.length > 0 || (stagingStatus.metadata && stagingStatus.metadata.length > 0)) {
    console.log(chalk.cyan('\n暂存区:'));
    
    if (staged.added.length > 0) {
      console.log(chalk.green('  新增:'));
      staged.added.forEach(file => console.log(`    ${file}`));
    }
    
    if (staged.modified.length > 0) {
      console.log(chalk.blue('  修改:'));
      staged.modified.forEach(file => console.log(`    ${file}`));
    }
    
    if (staged.deleted.length > 0) {
      console.log(chalk.red('  删除:'));
      staged.deleted.forEach(file => console.log(`    ${file}`));
    }
    
    if (staged.renamed.length > 0) {
      console.log(chalk.magenta('  重命名:'));
      staged.renamed.forEach(r => console.log(`    ${r.old} -> ${r.new}`));
    }

    if (stagingStatus.metadata && stagingStatus.metadata.length > 0) {
      console.log(chalk.yellow('  元数据变更:'));
      stagingStatus.metadata.forEach(m => {
        const changes = [];
        if (m.tags) changes.push(`tags: [${m.tags.join(', ')}]`);
        if (m.status) changes.push(`status: ${m.status}`);
        if (m.category) changes.push(`category: ${m.category}`);
        console.log(chalk.yellow(`    ${m.rid}  ${changes.join(', ')}`));
      });
    }
  }

  if (unstaged.modified.length > 0 || unstaged.deleted.length > 0 || unstaged.renamed.length > 0) {
    console.log(chalk.cyan('\n未暂存的修改:'));
    
    if (unstaged.modified.length > 0) {
      console.log(chalk.blue('  修改:'));
      unstaged.modified.forEach(file => console.log(`    ${file}`));
    }
    
    if (unstaged.deleted.length > 0) {
      console.log(chalk.red('  删除:'));
      unstaged.deleted.forEach(file => console.log(`    ${file}`));
    }

    if (unstaged.renamed.length > 0) {
      console.log(chalk.magenta('  重命名:'));
      unstaged.renamed.forEach(r => console.log(`    ${r.old} -> ${r.new}`));
    }
  }

  if (actualUntracked && actualUntracked.length > 0) {
    console.log(chalk.cyan('\n未跟踪的文件:'));
    actualUntracked.forEach(file => {
      console.log(chalk.green(`    ${file}`));
    });
  }

  if (stagingStatus.added.length === 0 && 
      stagingStatus.modified.length === 0 &&
      stagingStatus.deleted.length === 0 && 
      stagingStatus.renamed.length === 0 &&
      (!stagingStatus.metadata || stagingStatus.metadata.length === 0) &&
      unstaged.modified.length === 0 && 
      unstaged.deleted.length === 0 &&
      unstaged.renamed.length === 0 &&
      actualUntracked.length === 0) {
    console.log(chalk.gray('\n工作区干净'));
  }

  await repo.close();
  process.exit(0);
}

module.exports = status;