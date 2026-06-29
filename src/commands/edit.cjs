const fs = require('fs-extra');
const { spawnSync } = require('child_process');
const Logger = require('../utils/logger.cjs');
const config = require('../config/default.cjs');

module.exports = function edit(argv) {
  const { file, editor } = argv;
  
  try {
    if (!fs.existsSync(file)) {
      Logger.error(`文件不存在: ${file}`);
      process.exit(1);
    }
    
    const editorPath = editor || config.editor;
    const result = spawnSync(editorPath, [file], {
      stdio: 'inherit',
      shell: true
    });
    
    if (result.error) {
      Logger.error(`启动编辑器失败: ${result.error.message}`);
      process.exit(1);
    }
    
    Logger.success('编辑完成');
    
  } catch (error) {
    Logger.error(`编辑笔记失败: ${error.message}`);
    process.exit(1);
  }
};