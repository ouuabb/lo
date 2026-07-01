const fs = require('fs-extra');
const path = require('path');
const Logger = require('../utils/logger.cjs');

module.exports = async function configCmd(argv) {
  const { action, key, dir } = argv;
  
  const configPath = path.join(process.cwd(), '.note', 'config.json');
  
  try {
    let config = {};
    if (await fs.pathExists(configPath)) {
      config = await fs.readJson(configPath);
    }
    
    switch (action) {
      case 'list':
        Logger.title('配置列表');
        console.log(JSON.stringify(config, null, 2));
        break;
        
      case 'add':
        if (!key || !dir) {
          Logger.error('请提供配置键名和路径');
          process.exit(1);
        }
        if (!config.directories) {
          config.directories = {};
        }
        config.directories[key] = dir;
        await fs.writeJson(configPath, config, { spaces: 2 });
        Logger.success(`已添加配置: ${key} -> ${dir}`);
        break;
        
      case 'rm':
        if (!key) {
          Logger.error('请提供配置键名');
          process.exit(1);
        }
        if (config.directories && config.directories[key]) {
          delete config.directories[key];
          await fs.writeJson(configPath, config, { spaces: 2 });
          Logger.success(`已移除配置: ${key}`);
        } else {
          Logger.error(`配置键 "${key}" 不存在`);
        }
        break;
    }
    
  } catch (error) {
    Logger.error(`配置操作失败: ${error.message}`);
    process.exit(1);
  }
};