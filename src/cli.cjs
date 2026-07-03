#!/usr/bin/env node

const yargs = require('yargs');
const chalk = require('chalk');
const packageJson = require('../package.json');

const init = require('./commands/init.cjs');
const newResource = require('./commands/new.cjs');
const list = require('./commands/list.cjs');
const show = require('./commands/show.cjs');
const edit = require('./commands/edit.cjs');
const deleteResource = require('./commands/delete.cjs');
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
const importCmd = require('./commands/import.cjs');
const sync = require('./commands/sync.cjs');
const manual = require('./commands/manual.cjs');
const status = require('./commands/status.cjs');
const add = require('./commands/add.cjs');
const commit = require('./commands/commit.cjs');
const reset = require('./commands/reset.cjs');
const log = require('./commands/log.cjs');
const auth = require('./commands/auth.cjs');

const cli = yargs
  .scriptName('lo')
  .version(packageJson.version)
  .usage('$0 <command> [options]')
  .example('$0 new "理解闭包" --type note', '创建新资源')
  .example('$0 list --type image', '列出所有图片资源')
  .example('$0 find "分布式"', '搜索资源')
  .help()
  .alias('h', 'help')
  .alias('v', 'version');

cli
  .command('init', '初始化资源仓库', (yargs) => {
    yargs.option('path', {
      type: 'string',
      description: '初始化路径',
      default: process.cwd()
    });
  }, init)

  .command('import <path>', '导入资源', (yargs) => {
    yargs
      .positional('path', {
        type: 'string',
        description: '文件或目录路径'
      })
      .option('type', {
        type: 'string',
        description: '资源类型 (note, image, pdf, etc.)'
      });
  }, importCmd)

  .command('new <title>', '创建新资源', (yargs) => {
    yargs
      .positional('title', {
        type: 'string',
        description: '资源标题'
      })
      .option('type', {
        type: 'string',
        description: '资源类型',
        default: 'note',
        choices: ['note', 'pdf', 'image', 'video', 'audio', 'html', 'text']
      })
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
        description: '分类目录'
      });
  }, newResource)

  .command('list', '列出所有资源', (yargs) => {
    yargs
      .option('type', {
        type: 'string',
        description: '按类型过滤 (note, image, pdf, etc.)'
      })
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

  .command('show <rid>', '查看资源', (yargs) => {
    yargs
      .positional('rid', {
        type: 'string',
        description: '资源 RID 或文件路径'
      })
      .option('raw', {
        type: 'boolean',
        description: '显示原始内容',
        default: false
      });
  }, show)

  .command('edit <rid>', '编辑资源', (yargs) => {
    yargs
      .positional('rid', {
        type: 'string',
        description: '资源 RID 或文件路径'
      })
      .option('editor', {
        type: 'string',
        description: '指定编辑器'
      });
  }, edit)

  .command('delete <rid>', '删除资源', (yargs) => {
    yargs
      .positional('rid', {
        type: 'string',
        description: '资源 RID 或文件路径'
      })
      .option('force', {
        type: 'boolean',
        description: '强制删除，不确认'
      })
      .option('hard', {
        type: 'boolean',
        description: '永久删除（不可恢复）',
        default: false
      });
  }, deleteResource)

  .command('index', '生成索引', {}, index)

  .command('tag <action> <rid> [tag]', '管理标签', (yargs) => {
    yargs
      .positional('action', {
        type: 'string',
        choices: ['add', 'rm', 'list']
      })
      .positional('rid', {
        type: 'string',
        description: '资源 RID 或文件路径'
      });
  }, tag)

  .command('find <query>', '搜索资源', (yargs) => {
    yargs
      .positional('query', {
        type: 'string',
        description: '搜索关键词'
      })
      .option('limit', {
        type: 'number',
        description: '结果数量限制',
        default: 10
      })
      .option('type', {
        type: 'string',
        description: '按类型过滤'
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

  .command('link <from> <to>', '建立资源链接', (yargs) => {
    yargs
      .positional('from', {
        type: 'string',
        description: '源资源 RID 或路径'
      })
      .positional('to', {
        type: 'string',
        description: '目标资源 RID 或路径'
      })
      .option('type', {
        type: 'string',
        description: '链接类型',
        default: 'reference'
      });
  }, link)

  .command('move <rid> <dest>', '移动资源', (yargs) => {
    yargs
      .positional('rid', {
        type: 'string',
        description: '资源 RID 或文件路径'
      })
      .positional('dest', {
        type: 'string',
        description: '目标路径'
      });
  }, move)

  .command('backup', '备份资源仓库', (yargs) => {
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

  .command('config <action> [key] [dir]', '管理配置', (yargs) => {
    yargs
      .positional('action', {
        type: 'string',
        describe: '操作类型',
        choices: ['list', 'add', 'rm']
      })
      .positional('key', {
        type: 'string',
        describe: '配置键名'
      })
      .positional('dir', {
        type: 'string',
        describe: '目录路径'
      });
  }, configCmd)

  .command('sync', '同步资源', (yargs) => {
    yargs
      .option('full', {
        type: 'boolean',
        description: '执行全量同步（扫描所有文件，而非增量）',
        default: false
      })
      .option('quiet', {
        type: 'boolean',
        description: '静默模式，不输出详细报告',
        default: false
      });
  }, sync)

  .command('manual', '查看完整手册', {}, manual)

  .command('status', '查看工作区状态', (yargs) => {
    yargs.option('path', {
      type: 'string',
      description: '仓库路径',
      default: process.cwd()
    });
  }, status)

  .command('add [path]', '添加文件到暂存区', (yargs) => {
    yargs
      .positional('path', {
        type: 'string',
        description: '文件或目录路径，使用 . 添加所有'
      });
  }, add)

  .command('commit', '提交暂存区到仓库', (yargs) => {
    yargs
      .option('message', {
        type: 'string',
        alias: 'm',
        description: '提交信息'
      });
  }, commit)

  .command('reset [path]', '取消暂存或清空暂存区', (yargs) => {
    yargs
      .positional('path', {
        type: 'string',
        description: '文件路径，使用 HEAD 清空所有'
      });
  }, reset)

  .command('log', '查看提交历史', (yargs) => {
    yargs
      .option('limit', {
        type: 'number',
        alias: 'n',
        description: '显示数量限制',
        default: 20
      });
  }, log)

  .command('auth <action>', '管理 SSH 身份认证（支持多设备）', (yargs) => {
    yargs
      .positional('action', {
        type: 'string',
        description: '认证操作',
        choices: ['add', 'enable', 'remove', 'list', 'disable', 'status', 'verify', 'keys']
      })
      .option('key-path', {
        type: 'string',
        alias: 'k',
        description: 'SSH 公钥路径（用于 add）'
      })
      .option('label', {
        type: 'string',
        alias: 'l',
        description: '密钥标签，如"笔记本"、"台式机"（用于 add）'
      })
      .option('fingerprint', {
        type: 'string',
        alias: 'f',
        description: '密钥指纹（用于 remove）'
      })
      .option('ttl', {
        type: 'number',
        description: '认证会话有效期（分钟，默认 15）',
        default: 15
      });
  }, auth);

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