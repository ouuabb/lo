const path = require('path');
const fs = require('fs-extra');
const Logger = require('../utils/logger.cjs');
const StringUtils = require('../utils/string.cjs');
const DateUtils = require('../utils/date.cjs');

module.exports = async function newResource(argv) {
  const { title, type = 'note', tags, template, category } = argv;

  try {
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

    const filePath = path.join(process.cwd(), 'resources', filename);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content);

    Logger.success(`资源已创建: ${filename}`);
    Logger.info('标题:', title);
    Logger.info('类型:', type);
    Logger.info('标签:', frontmatter.tags.join(', ') || '(无)');
    if (category) {
      Logger.info('分类:', category);
    }
    Logger.info('位置:', filePath);
    Logger.info('运行 lo add 以将资源添加到暂存区');

  } catch (error) {
    Logger.error(`创建失败: ${error.message}`);
    process.exit(1);
  }
};