const chalk = require('chalk');
const config = require('../config/default.cjs');

function getDirsInfo() {
  let text = `  ${chalk.green.bold(config.ROOT_DIR + '/')} ${chalk.green('★ 根目录（不可变）')}\n`;
  const entries = Object.entries(config.directories);
  if (entries.length > 0) {
    entries.forEach(([k, v]) => {
      text += `  ${chalk.cyan(config.ROOT_DIR + '/' + v)} ${chalk.yellow('(' + k + ')')}\n`;
    });
  } else {
    text += `  ${chalk.gray('(尚无子分类，用 lo config add 添加)')}\n`;
  }
  return text;
}

const helpText = `
${chalk.bold.cyan('╔══════════════════════════════════════════════╗')}
${chalk.bold.cyan('║')}   ${chalk.bold.white('lo-cli')} - 命令行 Markdown 笔记管理工具   ${chalk.bold.cyan('║')}
${chalk.bold.cyan('╚══════════════════════════════════════════════╝')}

${chalk.bold.yellow('命令列表:')}

  ${chalk.green('lo init')}                        初始化知识库（创建 docs/）
  ${chalk.green('lo new <title>')}                 创建新笔记
  ${chalk.green('lo list')}                       列出所有笔记（支持 --category）
  ${chalk.green('lo show <file>')}                 查看笔记内容
  ${chalk.green('lo edit <file>')}                 编辑笔记
  ${chalk.green('lo delete <file>')}               删除笔记
  ${chalk.green('lo index')}                      生成索引
  ${chalk.green('lo tag <add|rm|category> <file> [tag]')}  管理标签与分类
  ${chalk.green('lo find <query>')}                搜索笔记（支持按分类搜索）
  ${chalk.green('lo stats')}                      显示统计信息
  ${chalk.green('lo link <from> <to>')}            建立双向链接
  ${chalk.green('lo move <file> <dest>')}          移动笔记
  ${chalk.green('lo backup')}                     备份知识库
  ${chalk.green('lo daily')}                      创建今日日记
  ${chalk.green('lo config <action>')}             管理分类目录
  ${chalk.green('lo help')}                       显示帮助信息

${chalk.bold.yellow('快速开始:')}

  ${chalk.gray('# 1. 初始化知识库')}
  lo init

  ${chalk.gray('# 2. 创建笔记（默认存入 docs/）')}
  lo new "我的第一篇笔记" --tags 标签1,标签2

  ${chalk.gray('# 3. 添加子分类')}
  lo config add blog Blog            # 创建 docs/Blog/ 子目录
  lo config add projects Projects    # 创建 docs/Projects/ 子目录
  lo config list                     # 查看当前分类

  ${chalk.gray('# 4. 指定分类创建笔记（自动写入 frontmatter）')}
  lo new "技术文章" --category blog  # 存入 docs/Blog/，分类 = blog

  ${chalk.gray('# 5. 给已有笔记设置分类')}
  lo tag category docs/xxxx.md blog
  lo tag category docs/xxxx.md       # 不传分类名即移除分类

${chalk.bold.yellow('常用选项:')}

  --tags      标签，逗号分隔（用于 new）
  --status    按状态过滤: draft / published / archived
  --tag       按标签过滤（用于 list / find）
  --category  指定分类（new 写入 frontmatter；list / find 过滤）
  --limit     限制显示数量
  --format    输出格式: table / json / list（用于 list）
  --force     跳过确认（用于 delete）

${chalk.bold.yellow('目录结构:')}

${getDirsInfo()}
  templates/     模板文件
  .note/         配置文件

${chalk.bold.yellow('笔记格式 (YAML Frontmatter):')}

  ---
  title: 笔记标题
  created: '2026-06-29'
  category: blog       # 可选，笔记分类
  tags:
    - js
    - 前端
  status: draft
  ---
  # 笔记标题

  正文内容...
  相关笔记：[[另一篇笔记]]

${chalk.gray('使用 lo --help 查看 yargs 内置帮助')}
`;

module.exports = function help(argv) {
  console.log(helpText);
};