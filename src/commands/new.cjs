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

    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const content = `# ${title}\n\n开始写作...\n`;

    const filePath = path.join(process.cwd(), 'resources', filename);
    await fs.ensureDir(path.dirname(filePath));

    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    // 默认分类：未显式指定时，根据资源类型应用默认值
    let finalCategory = category;
    if (!finalCategory) {
      const defaultNote = await repo.getConfig('category.defaultNote', '未分类');
      const defaultOther = await repo.getConfig('category.defaultOther', '其他资源');
      finalCategory = (type === 'note') ? defaultNote : defaultOther;
    }

    const cryptoKey = repo.cryptoKey;
    const encryptionEnabled = CryptoUtils.isEncryptionEnabled(process.cwd());

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

    // 同步写入 SQLite（含 tags/category）
    try {
      const metadata = { title };
      if (tagList.length > 0) metadata.tags = tagList;
      if (finalCategory) metadata.category = finalCategory;

      await repo.resourceService.create({
        type,
        path: filePath,
        metadata
      });
      Logger.success(`资源已入库`);
      if (tagList.length > 0) Logger.info('标签:', tagList.join(', '));
    } catch (e) {
      Logger.warn(`自动入库失败（文件已创建，请手动 lo add）: ${e.message}`);
    }

    await repo.close();

    Logger.info('标题:', title);
    Logger.info('类型:', type);
    if (finalCategory) Logger.info('分类:', finalCategory);
    Logger.info('位置:', filePath);

    process.exit(0);

  } catch (error) {
    Logger.error(`创建失败: ${error.message}`);
    process.exit(1);
  }
};
