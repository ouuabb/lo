const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const Repository = require('../repo/repository.cjs');
const StagingArea = require('../repo/staging.cjs');

async function rm(argv) {
  const repoPath = process.cwd();
  const targetPath = argv.path || argv._[1];

  const repo = new Repository(repoPath);
  await repo.open();

  const staging = new StagingArea(repoPath);
  const resourcesDir = path.join(repoPath, 'resources');

  if (!await fs.pathExists(resourcesDir)) {
    console.log(chalk.red('resources 目录不存在'));
    await repo.close();
    process.exit(0);
    return;
  }

  if (!targetPath) {
    console.log(chalk.red('请指定要删除的文件'));
    console.log(chalk.gray('用法: lo rm <文件路径>'));
    await repo.close();
    process.exit(0);
    return;
  }

  const absPath = path.isAbsolute(targetPath)
    ? targetPath
    : path.join(repoPath, targetPath);

  if (!absPath.startsWith(resourcesDir)) {
    console.log(chalk.red('文件必须在 resources 目录下'));
    await repo.close();
    process.exit(0);
    return;
  }

  const relPath = await staging.remove(absPath);
  console.log(chalk.red(`\n暂存删除: ${relPath}`));

  await repo.close();
  process.exit(0);
}

module.exports = rm;
