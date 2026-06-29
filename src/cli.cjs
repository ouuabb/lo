#!/usr/bin/env node

const yargs = require('yargs');
const chalk = require('chalk');
const packageJson = require('../package.json');

const init = require('./commands/init.cjs');
const newNote = require('./commands/new.cjs');
const list = require('./commands/list.cjs');
const show = require('./commands/show.cjs');
const edit = require('./commands/edit.cjs');
const deleteNote = require('./commands/delete.cjs');
const index = require('./commands/index.cjs');
const tag = require('./commands/tag.cjs');
const find = require('./commands/find.cjs');
const stats = require('./commands/stats.cjs');
const link = require('./commands/link.cjs');
const move = require('./commands/move.cjs');
const backup = require('./commands/backup.cjs');
const daily = require('./commands/daily.cjs');
const configCmd = require('./commands/config.cjs');
const help = require('./commands/help.cjs');

const cli = yargs
  .scriptName('lo')
  .version(packageJson.version)
  .usage('$0 <command> [options]')
  .example('$0 new "理解闭包" --tags js,面试', '创建新笔记')
  .example('$0 list --status published', '列出所有已发布笔记')
  .example('$0 find "分布式"', '搜索笔记')
  .help()
  .alias('h', 'help')
  .alias('v', 'version');

cli
  .command('init', '初始化知识库', (yargs) => {
    yargs.option('path', {
      type: 'string',
      description: '初始化路径',
      default: process.cwd()
    });
  }, init)

  .command('new <title>', '创建新笔记', (yargs) => {
    yargs
      .option('tags', {
        type: 'string',
        description: '标签，逗号分隔'
      })
      .option('template', {
        type: 'string',
        description: '使用模板'
      })
      .option('category', {
        type: 'string',
        description: '分类目录（用 lo config list 查看可用分类）'
      });
  }, newNote)

  .command('list', '列出所有笔记', (yargs) => {
    yargs
      .option('status', {
        type: 'string',
        description: '按状态过滤',
        choices: ['draft', 'published', 'archived']
      })
      .option('tag', {
        type: 'string',
        description: '按标签过滤'
      })
      .option('category', {
        type: 'string',
        description: '按分类过滤'
      })
      .option('limit', {
        type: 'number',
        description: '限制数量',
        default: 20
      })
      .option('format', {
        type: 'string',
        description: '输出格式',
        choices: ['table', 'json', 'list'],
        default: 'table'
      });
  }, list)

  .command('show <file>', '查看笔记内容', (yargs) => {
    yargs
      .option('raw', {
        type: 'boolean',
        description: '显示原始Markdown',
        default: false
      });
  }, show)

  .command('edit <file>', '编辑笔记', (yargs) => {
    yargs
      .option('editor', {
        type: 'string',
        description: '指定编辑器'
      });
  }, edit)

  .command('delete <file>', '删除笔记', (yargs) => {
    yargs
      .option('force', {
        type: 'boolean',
        description: '强制删除，不确认'
      });
  }, deleteNote)

  .command('index', '生成索引README', {}, index)

  .command('tag <action> <file> [tag]', '管理标签与分类', (yargs) => {
    yargs
      .positional('action', {
        type: 'string',
        choices: ['add', 'rm', 'category']
      });
  }, tag)

  .command('find <query>', '搜索笔记', (yargs) => {
    yargs
      .option('limit', {
        type: 'number',
        description: '结果数量限制',
        default: 10
      })
      .option('type', {
        type: 'string',
        description: '搜索类型',
        choices: ['full', 'title', 'tag', 'category'],
        default: 'full'
      })
      .option('category', {
        type: 'string',
        description: '按分类过滤搜索结果'
      });
  }, find)

  .command('stats', '显示统计信息', (yargs) => {
    yargs
      .option('today', {
        type: 'boolean',
        description: '只统计今天'
      })
      .option('week', {
        type: 'boolean',
        description: '只统计本周'
      });
  }, stats)

  .command('link <from> <to>', '建立双向链接', {}, link)

  .command('move <file> <dest>', '移动笔记', (yargs) => {
    yargs
      .option('category', {
        type: 'string',
        description: '目标分类（用 lo config list 查看可用分类）'
      });
  }, move)

  .command('backup', '备份知识库', (yargs) => {
    yargs
      .option('dest', {
        type: 'string',
        description: '备份目标目录',
        default: './backups'
      })
      .option('compress', {
        type: 'boolean',
        description: '压缩备份',
        default: false
      });
  }, backup)

  .command('daily', '创建今日日记', {}, daily)

  .command('config <action> [key] [dir]', '管理分类目录', (yargs) => {
    yargs
      .positional('action', {
        type: 'string',
        describe: '操作类型',
        choices: ['list', 'add', 'rm']
      })
      .positional('key', {
        type: 'string',
        describe: '分类名称 (add/rm 时使用)'
      })
      .positional('dir', {
        type: 'string',
        describe: '目录路径 (add 时使用)'
      });
  }, configCmd);

cli.fail((msg, err, yargs) => {
  if (err) {
    console.error(chalk.red('Error:'), err.message);
  } else if (msg) {
    console.error(chalk.red('Error:'), msg);
    yargs.showHelp();
  }
  process.exit(1);
});

const args = process.argv.slice(2);

if (args[0] === 'help') {
  help({});
  process.exit(0);
}

cli.parse(args);

module.exports = cli;