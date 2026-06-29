const fs = require('fs-extra');
const path = require('path');
const Logger = require('../utils/logger.cjs');
const config = require('../config/default.cjs');

module.exports = async function init(argv) {
  const targetPath = argv.path || process.cwd();

  try {
    Logger.info(`正在初始化知识库: ${targetPath}`);

    if (fs.existsSync(path.join(targetPath, '.note'))) {
      Logger.warn('知识库已存在');
      return;
    }

    // 创建笔记根目录 docs/
    await fs.ensureDir(path.join(targetPath, config.ROOT_DIR));

    // 创建配置目录和文件
    await fs.ensureDir(path.join(targetPath, '.note'));

    const configToSave = {
      directories: {},
      editor: config.editor
    };
    const configPath = path.join(targetPath, '.note', 'config.json');
    await fs.writeJson(configPath, configToSave, { spaces: 2 });

    // 创建模板目录
    await fs.ensureDir(path.join(targetPath, 'templates'));

    const templatePath = path.join(targetPath, 'templates', 'default.md.template');
    await fs.writeFile(templatePath, `# {{title}}\n\n开始写作...\n`);

    const dailyTemplatePath = path.join(targetPath, 'templates', 'daily.md.template');
    await fs.writeFile(dailyTemplatePath, `# {{date}} 日记\n\n## 今日完成\n\n- \n\n## 待办事项\n\n- [ ] \n\n## 想法记录\n\n`);

    const gitignorePath = path.join(targetPath, '.gitignore');
    await fs.writeFile(gitignorePath, `.note/\nnode_modules/\nbackups/\n.DS_Store\n`);

    Logger.success(`✅ 知识库初始化完成: ${targetPath}`);
    Logger.info(`📂 笔记根目录: ${config.ROOT_DIR}/`);
    Logger.info('接下来你可以:');
    Logger.info('  lo new "我的第一篇笔记"');
    Logger.info('  lo config add blog Blog           添加子分类');
    Logger.info('  lo config list                     查看分类');

  } catch (error) {
    Logger.error(`初始化失败: ${error.message}`);
    process.exit(1);
  }
};