const path = require('path');
const fs = require('fs-extra');
const Logger = require('../utils/logger.cjs');
const StringUtils = require('../utils/string.cjs');
const DateUtils = require('../utils/date.cjs');
const CryptoUtils = require('../utils/crypto.cjs');
const Repository = require('../repo/repository.cjs');

module.exports = async function newResource(argv) {
  const { title, type = 'note', tags, category } = argv;

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

    let cryptoKey = null;
    const encryptionEnabled = CryptoUtils.isEncryptionEnabled(process.cwd());
    if (encryptionEnabled) {
      try {
        const repo = new Repository(process.cwd());
        await repo.open({ skipAuth: true });
        cryptoKey = repo.cryptoKey;
        await repo.close();
      } catch (e) {
        Logger.warn(`无法获取加密密钥: ${e.message}`);
      }
    }

    if (cryptoKey) {
      await CryptoUtils.writeEncryptedFile(filePath, Buffer.from(content, 'utf-8'), cryptoKey);
      Logger.success(`资源已创建 (加密): ${filename}`);
    } else if (encryptionEnabled) {
      Logger.error('仓库启用了加密但无法获取密钥。如果是首次设置，请确保密钥已生成；如果已绑定 SSH，请确保私钥可用。');
      Logger.info(`文件将在您完成认证后通过 lo sync 加密`);
      await fs.writeFile(filePath, content);
      Logger.warn(`资源以明文创建（待加密）: ${filename}`);
    } else {
      await fs.writeFile(filePath, content);
      Logger.success(`资源已创建: ${filename}`);
    }

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
