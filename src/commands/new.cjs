const path = require('path');
const crypto = require('crypto');
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

    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    // 校验名称全局唯一，同名时自动入栈（layer >= 1）
    const activeByName = await repo.resourceService.getByName(slug);
    if (activeByName) {
      Logger.warn(`资源名称 "${slug}" 已存在活跃层（rid: ${activeByName.rid}），新文件将在提交时自动入栈。`);
      Logger.info('提示: 使用 lo stack list 查看栈中资源，lo stack promote <rid> 可提升为活跃层。');
    }

    // 文件名含随机后缀，保证磁盘层面永无冲突
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const filename = `${date}-${slug}-${randomSuffix}.md`;

    // 构建元数据
    const metadata = {
      title,
      ...(tags ? { tags: Array.isArray(tags) ? tags : tags.split(/[,，]/).map(s => s.trim()) } : {}),
      ...(category ? { category } : {})
    };

    const content = `# ${title}\n\n开始写作...\n`;

    const filePath = path.join(process.cwd(), 'resources', filename);
    await fs.ensureDir(path.dirname(filePath));

    // 写入文件（自动处理加密）
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

    await repo.close();

    Logger.info('标题:', title);
    Logger.info('类型:', type);
    if (metadata.category) Logger.info('分类:', metadata.category);
    Logger.info('位置:', filePath);

    process.exit(0);

  } catch (error) {
    Logger.error(`创建失败: ${error.message}`);
    process.exit(1);
  }
};
