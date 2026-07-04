const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const Repository = require('../repo/repository.cjs');
const StagingArea = require('../repo/staging.cjs');

async function add(argv) {
  const repoPath = process.cwd();
  const targetPath = argv.path || argv._[1];

  const repo = new Repository(repoPath);
  await repo.open();

  const staging = new StagingArea(repoPath);
  const resourcesDir = path.join(repoPath, 'resources');

  if (!await fs.pathExists(resourcesDir)) {
    console.log(chalk.red('resources 目录不存在'));
    await repo.close();
    return;
  }

  if (!targetPath || targetPath === '.') {
    const count = await staging.addAll(repo);
    const status = await staging.getStatus();
    console.log(chalk.green(`\n暂存了 ${count} 个文件`));
    if (status.added.length > 0) console.log(`  新增: ${status.added.length}`);
    if (status.modified.length > 0) console.log(chalk.blue(`  修改: ${status.modified.length}`));
    await repo.close();
    return;
  }

  const absPath = path.isAbsolute(targetPath)
    ? targetPath
    : path.join(repoPath, targetPath);

  const relToResources = path.relative(resourcesDir, absPath);

  if (!absPath.startsWith(resourcesDir)) {
    console.log(chalk.red('文件必须在 resources 目录下'));
    await repo.close();
    return;
  }

  if (!await fs.pathExists(absPath)) {
    console.log(chalk.red('文件不存在'));
    await repo.close();
    return;
  }

  const stats = await fs.stat(absPath);
  if (stats.isDirectory()) {
    const files = await fs.readdir(absPath, { recursive: true });
    let count = 0;
    for (const file of files) {
      const filePath = path.join(absPath, file);
      const fileStats = await fs.stat(filePath);
      if (fileStats.isFile()) {
        await staging.add(filePath, repo);
        count++;
      }
    }
    console.log(chalk.green(`\n暂存了 ${count} 个文件`));
  } else {
    const relPath = await staging.add(absPath, repo);
    const updated = await staging.getStatus();
    const isModified = updated.modified.includes(relPath);
    if (isModified) {
      console.log(chalk.blue(`\n暂存修改: ${relPath}`));
    } else {
      console.log(chalk.green(`\n暂存: ${relPath}`));
    }
  }

  await repo.close();
  process.exit(0);
}

module.exports = add;
