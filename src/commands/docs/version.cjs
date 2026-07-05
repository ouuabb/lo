const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  版本控制系统'));
    console.log(`
  lo 内置类似 Git 的版本控制工作流：

    文件系统              暂存区              仓库历史
  ┌──────────┐       ┌──────────────┐       ┌──────────┐
  │ resources/ │  lo   │ staging.json │  lo   │ commits  │
  │ 文件变更   │ ────► │  暂存列表     │ ────► │ 表       │
  └──────────┘  add  └──────────────┘ commit └──────────┘

  命令映射：
    lo add <文件>         加入暂存区（自动区分新增/修改）
    lo rm <文件>          暂存删除
    lo diff [文件]        查看变更差异
    lo commit -m <信息>   提交为历史记录
    lo reset [文件]       取消暂存
    lo log                查看提交历史
    lo status             查看变更状态
    lo tag add/rm <rid>   暂存标签变更
    lo category set/rm <rid>  暂存分类变更

  commits 表结构：
    - id：自增主键
    - message：提交信息
    - timestamp：时间戳
    - added / updated / deleted / renamed / metadata：变更统计

  暂存模型 (staging.json)：
    - added[]   ：数据库中不存在的全新文件
    - modified[]：数据库中已有记录、内容已变更的文件
    - deleted[] ：已暂存待删除的文件
    - renamed[] ：已暂存的重命名操作
    - metadata[]：已暂存的元数据变更（标签、分类、状态）

  commit 处理：
    - added 文件 → 导入数据库（create）
    - modified 文件 → 调用 refresh() 更新散列和元数据（标题、字数）
    - deleted 文件 → 标记数据库记录为已删除
    - renamed 文件 → 更新数据库路径
    - metadata 变更 → 合并到数据库 metadata 列

  与 Git 的关系：
    两者可并行使用——Git 管理文件版本，lo 管理元数据和搜索。
    .repo/ 目录应在 .gitignore 中排除。`);
};
