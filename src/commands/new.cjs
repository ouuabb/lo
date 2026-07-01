const path = require('path');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');
const StringUtils = require('../utils/string.cjs');
const DateUtils = require('../utils/date.cjs');

module.exports = async function newResource(argv) {
  const { title, type = 'note', tags, template, category } = argv;

  try {
    const repo = new Repository(process.cwd());
    await repo.open();

    const slug = StringUtils.slugify(title);
    const date = DateUtils.today();
    const filename = `${date}-${slug}.md`;

    const frontmatter = {
      title: title,
      created: date,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      status: 'draft'
    };

    if (category) {
      frontmatter.category = category;
    }

    const content = `---\n${Object.entries(frontmatter).map(([k, v]) => 
      typeof v === 'string' ? `${k}: ${v}` : `${k}: ${JSON.stringify(v)}`
    ).join('\n')}\n---\n\n# ${title}\n\n开始写作...\n`;

    const metadata = {
      title: title,
      tags: frontmatter.tags,
      category: category || null,
      status: 'draft'
    };

    const resource = await repo.createResource(type, content, {
      filename,
      metadata
    });

    Logger.success(`资源已创建: ${resource.rid}`);
    Logger.info('标题:', title);
    Logger.info('类型:', type);
    Logger.info('标签:', frontmatter.tags.join(', ') || '(无)');
    if (category) {
      Logger.info('分类:', category);
    }
    Logger.info('位置:', resource.path);
    Logger.info('编辑: lo edit ' + resource.rid);

    await repo.close();

  } catch (error) {
    Logger.error(`创建失败: ${error.message}`);
    process.exit(1);
  }
};