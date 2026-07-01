const { exec } = require('child_process');
const fs = require('fs-extra');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');
const config = require('../config/default.cjs');

module.exports = async function edit(argv) {
  const { rid, editor } = argv;
  
  try {
    const repo = new Repository(process.cwd());
    await repo.open();

    let resource;
    
    if (rid.startsWith('res_')) {
      resource = await repo.getResource(rid);
    } else {
      resource = await repo.getResourceByPath(rid);
      if (!resource) {
        resource = await repo.getResourceByPath(process.cwd() + '/' + rid);
      }
    }
    
    await repo.close();

    if (!resource) {
      Logger.error(`资源不存在: ${rid}`);
      process.exit(1);
    }

    const useEditor = editor || config.editor || 'notepad';

    exec(`"${useEditor}" "${resource.path}"`, (error) => {
      if (error) {
        Logger.error(`编辑失败: ${error.message}`);
        process.exit(1);
      }
    });

    Logger.info(`正在编辑: ${resource.metadata.title || '未命名资源'}`);

  } catch (error) {
    Logger.error(`编辑资源失败: ${error.message}`);
    process.exit(1);
  }
};