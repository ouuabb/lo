const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const Logger = require('../utils/logger.cjs');

const ROOT_DIR = 'docs';

function getConfigPath() {
  return path.join(process.cwd(), '.note', 'config.json');
}

function getCurrentConfig() {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    return fs.readJsonSync(configPath);
  }
  return { directories: {} };
}

function saveConfig(data) {
  const configPath = getConfigPath();
  fs.ensureDirSync(path.dirname(configPath));
  fs.writeJsonSync(configPath, data, { spaces: 2 });
}

module.exports = function configCommand(argv) {
  const { action, key, dir } = argv;

  try {
    if (!fs.existsSync(path.join(process.cwd(), '.note'))) {
      Logger.warn('请先运行 lo init 初始化知识库');
      return;
    }

    const current = getCurrentConfig();

    switch (action) {
      case 'list': {
        Logger.title('分类目录（均位于 docs/ 下）');
        console.log(`  ${chalk.green.bold(ROOT_DIR + '/')} ${chalk.green('★ 根目录（不可变）')}`);
        const entries = Object.entries(current.directories);
        if (entries.length > 0) {
          entries.forEach(([k, v]) => {
            console.log(`  ${chalk.cyan(ROOT_DIR + '/' + v)} ${chalk.yellow('(' + k + ')')}`);
          });
        } else {
          console.log(`  ${chalk.gray('(尚无子分类)')}`);
        }
        break;
      }

      case 'add': {
        if (!key || !dir) {
          Logger.error('用法: lo config add <key> <子目录名>');
          Logger.info('示例: lo config add blog Blog   → docs/Blog/');
          return;
        }
        // 禁止使用 docs 作为 key
        if (key === 'docs') {
          Logger.error('"docs" 是保留根目录，不能作为分类名');
          return;
        }
        if (!current.directories) current.directories = {};
        if (current.directories[key]) {
          Logger.warn(`分类 "${key}" 已存在，将被覆盖`);
        }
        current.directories[key] = dir;
        saveConfig(current);

        // 创建对应的物理目录
        const fullDir = path.join(process.cwd(), ROOT_DIR, dir);
        fs.ensureDirSync(fullDir);
        Logger.success(`已添加分类: ${key} → ${ROOT_DIR}/${dir}/`);
        break;
      }

      case 'rm': {
        if (!key) {
          Logger.error('用法: lo config rm <key>');
          return;
        }
        if (key === 'docs') {
          Logger.error('"docs" 是根目录，不允许删除');
          return;
        }
        if (!current.directories || !current.directories[key]) {
          Logger.error(`分类 "${key}" 不存在`);
          return;
        }
        delete current.directories[key];
        saveConfig(current);
        Logger.success(`已移除分类: ${key}（目录和文件不会自动删除）`);
        break;
      }

      default:
        Logger.error('无效操作，可用: list / add / rm');
    }

  } catch (error) {
    Logger.error(`配置操作失败: ${error.message}`);
    process.exit(1);
  }
};