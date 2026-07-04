const chalk = require('chalk');
const path = require('path');
const Repository = require('../repo/repository.cjs');
const StagingArea = require('../repo/staging.cjs');

async function reset(argv) {
  const repoPath = process.cwd();
  const targetPath = argv.path || argv._[1];
  
  const repo = new Repository(repoPath);
  await repo.open();
  
  const staging = new StagingArea(repoPath);
  
  if (!targetPath || targetPath === 'HEAD') {
    await staging.reset();
    console.log(chalk.yellow('\n已清空暂存区'));
    await repo.close();
    process.exit(0);
    return;
  }

  const resourcesDir = path.join(repoPath, 'resources');
  const absPath = path.isAbsolute(targetPath) 
    ? targetPath 
    : path.join(resourcesDir, targetPath);
  
  if (!absPath.startsWith(resourcesDir)) {
    console.log(chalk.red('文件必须在 resources 目录下'));
    await repo.close();
    process.exit(0);
    return;
  }

  const relPath = await staging.reset(absPath);
  if (relPath) {
    console.log(chalk.yellow(`\n已取消暂存: ${relPath}`));
  } else {
    console.log(chalk.yellow('\n文件不在暂存区'));
  }
  
  await repo.close();
  process.exit(0);
}

module.exports = reset;