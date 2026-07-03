const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');
const CryptoUtils = require('../utils/crypto.cjs');

module.exports = async function init(argv) {
  const targetPath = argv.path || process.cwd();

  try {
    Logger.info(`正在初始化资源仓库: ${targetPath}`);

    if (fs.existsSync(path.join(targetPath, '.repo'))) {
      Logger.warn('资源仓库已存在');
      return;
    }

    const repo = await Repository.create(targetPath);
    await repo.close();

    // ── 生成端到端加密密钥 ──
    const { repoKey, keyFilePath } = CryptoUtils.initRepoKey(targetPath);
    Logger.success(`端到端加密密钥已生成 (AES-256-GCM)`);
    Logger.info(`  密钥文件: ${path.relative(targetPath, keyFilePath)}`);
    Logger.info(`  密钥强度: 256-bit`);
    Logger.info(`  加密算法: AES-256-GCM (认证加密)`);
    Logger.info(`  文件格式: LOEC v1 (魔数 + 版本 + IV + 密文 + 认证标签)`);

    await fs.ensureDir(path.join(targetPath, 'templates'));

    const templatePath = path.join(targetPath, 'templates', 'default.md.template');
    await fs.writeFile(templatePath, `# {{title}}\n\n开始写作...\n`);

    const dailyTemplatePath = path.join(targetPath, 'templates', 'daily.md.template');
    await fs.writeFile(dailyTemplatePath, `# {{date}} 日记\n\n## 今日完成\n\n- \n\n## 待办事项\n\n- [ ] \n\n## 想法记录\n\n`);

    const gitignorePath = path.join(targetPath, '.gitignore');
    await fs.writeFile(gitignorePath, `.repo/\nnode_modules/\nbackups/\n.DS_Store\n`);

    Logger.success(`资源仓库初始化完成: ${targetPath}`);
    Logger.info(`资源目录: resources/`);
    Logger.info('');
    Logger.info('安全提示:');
    Logger.info(`  仓库文件已启用端到端加密保护`);
    Logger.info(`  执行 ${chalk.cyan('lo auth add')} 绑定 SSH 密钥以保护加密密钥`);
    Logger.info('');
    Logger.info('接下来你可以:');
    Logger.info('  lo new "我的第一篇笔记"');
    Logger.info('  lo import /path/to/files       导入现有文件');
    Logger.info('  lo list                         查看资源列表');

  } catch (error) {
    Logger.error(`初始化失败: ${error.message}`);
    process.exit(1);
  }
};