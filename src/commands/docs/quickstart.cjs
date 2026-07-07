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

  # 8. 远程同步
  lo remote add my-server user@host:~/notes     # 添加远程仓库
  lo push my-server                             # 推送到远程
  lo pull my-server                             # 从远程拉取

  # 9. 为已有仓库建立到本地的软链接（可选）
  lo serve                                      # 启动同步服务（默认 8100 端口）
  # 在另一台电脑上：
  lo clone user@host:~/notes ~/my-notes         # 克隆远程仓库到本地

  更多信息：
    lo manual <命令名>   查看特定命令的用法
    lo help              查看简洁命令列表`);
};
