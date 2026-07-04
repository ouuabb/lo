const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');
const DateUtils = require('../utils/date.cjs');

module.exports = async function daily(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open();

    const today = DateUtils.today();
    const dateStr = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    const content = `# ${dateStr}

## 今日完成

- 

## 待办事项

- [ ] 

## 想法记录

`;

    const metadata = {
      title: `${dateStr} 日记`,
      tags: ['daily'],
      status: 'draft'
    };

    const resource = await repo.createResource('note', content, {
      filename: `${today}-daily.md`,
      metadata
    });

    Logger.success(`今日日记已创建: ${resource.rid}`);
    Logger.info('位置:', resource.path);
    Logger.info('编辑: lo edit ' + resource.rid);

    await repo.close();

    process.exit(0);

  } catch (error) {
    Logger.error(`创建日记失败: ${error.message}`);
    process.exit(1);
  }
};
