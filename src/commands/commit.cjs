const chalk = require('chalk');
const Repository = require('../repo/repository.cjs');
const StagingArea = require('../repo/staging.cjs');

async function commit(argv) {
  const repoPath = process.cwd();
  const message = argv.message || argv.m;
  
  const repo = new Repository(repoPath);
  await repo.open();
  
  const staging = new StagingArea(repoPath);
  const hasChanges = await staging.hasChanges();
  
  if (!hasChanges) {
    console.log(chalk.yellow('\n暂存区为空'));
    await repo.close();
    return;
  }

  const status = await staging.getStatus();
  
  console.log(chalk.bold('\n暂存区内容'));
  console.log('-------------');
  
  if (status.added.length > 0) {
    console.log(chalk.green('\n新增:'));
    status.added.forEach(file => console.log(`  ${file}`));
  }
  
  if (status.deleted.length > 0) {
    console.log(chalk.red('\n删除:'));
    status.deleted.forEach(file => console.log(`  ${file}`));
  }
  
  if (status.renamed.length > 0) {
    console.log(chalk.blue('\n重命名:'));
    status.renamed.forEach(r => console.log(`  ${r.old} -> ${r.new}`));
  }

  if (!message) {
    console.log(chalk.red('\n请提供提交信息'));
    console.log(chalk.gray('使用: lo commit -m "提交信息"'));
    await repo.close();
    return;
  }

  const result = await staging.commit(repo);
  await repo.commit(message, result);
  
  console.log(chalk.bold(`\n[提交] ${message}`));
  console.log(chalk.green(`新增: ${result.added}`));
  console.log(chalk.red(`删除: ${result.deleted}`));
  console.log(chalk.blue(`重命名: ${result.renamed}`));
  
  await repo.close();
}

module.exports = commit;