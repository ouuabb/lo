const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  快速上手指南'));
    console.log(`
  # 1. 创建新仓库
  lo init

  # 2. 生成 SSH 密钥（如果没有）
  ssh-keygen -t ed25519 -C "lo-notebook"

  # 3. 绑定 SSH 密钥保护加密密钥
  lo auth add -k ~/.ssh/id_ed25519 -l "我的电脑"

  # 4. 创建笔记
  lo new "我的第一篇加密笔记"

  # 5. 暂存和提交
  lo add .
  lo commit -m "初始导入"

  # 6. 日常操作
  lo list          # 查看所有笔记
  lo find "关键词"  # 搜索
  lo edit res_xxx  # 编辑
  lo show res_xxx  # 查看
  lo status        # 查看变更

  # 7. 备份
  lo backup --dest ~/backups

  更多信息：
    lo manual <命令名>   查看特定命令的用法
    lo help              查看简洁命令列表`);
};
