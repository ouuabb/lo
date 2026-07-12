#!/usr/bin/env node

const yargs = require('yargs');
const chalk = require('chalk');
const packageJson = require('../package.json');

const init = require('./commands/init.cjs');
const newResource = require('./commands/new.cjs');
const list = require('./commands/list.cjs');
const files = require('./commands/files.cjs');
const show = require('./commands/show.cjs');
const edit = require('./commands/edit.cjs');
const deleteResource = require('./commands/delete.cjs');
const index = require('./commands/index.cjs');
const tag = require('./commands/tag.cjs');
const category = require('./commands/category.cjs');
const find = require('./commands/find.cjs');
const stats = require('./commands/stats.cjs');
const link = require('./commands/link.cjs');
const unlink = require('./commands/unlink.cjs');
const relationCmd = require('./commands/relation.cjs');
const graphCmd = require('./commands/graph.cjs');
const move = require('./commands/move.cjs');
const backup = require('./commands/backup.cjs');
const daily = require('./commands/daily.cjs');
const configCmd = require('./commands/config.cjs');
const help = require('./commands/help.cjs');
const importCmd = require('./commands/import.cjs');
const sync = require('./commands/sync.cjs');
const manual = require('./commands/manual.cjs');
const docs = require('./commands/docs/index.cjs');
const status = require('./commands/status.cjs');
const add = require('./commands/add.cjs');
const commit = require('./commands/commit.cjs');
const reset = require('./commands/reset.cjs');
const log = require('./commands/log.cjs');
const auth = require('./commands/auth.cjs');
const remote = require('./commands/remote.cjs');
const serve = require('./commands/serve.cjs');
const diff = require('./commands/diff.cjs');
const stack = require('./commands/stack.cjs');
const rm = require('./commands/rm.cjs');
const createResourceCmd = require('./commands/resource.cjs');
const containerCmd = require('./commands/container.cjs');

const cli = yargs
  .scriptName('lo')
  .version(packageJson.version)
  .usage('$0 <command> [options]')
  .example('$0 new "理解闭包" --type note', '创建新资源')
  .example('$0 list --type image', '列出所有图片资源')
  .example('$0 find "分布式"', '搜索资源')
  .help()
  .alias('h', 'help')
  .alias('v', 'version')
  .strict();

cli
  .command('init [name]', '初始化资源仓库', (yargs) => {
    yargs
      .positional('name', {
        type: 'string',
        description: '仓库文件夹名称或路径'
      })
      .option('path', {
        type: 'string',
        description: '初始化路径',
        default: process.cwd()
      });
  }, init)

  .command('import <path>', '导入资源（自动应用默认分类）', (yargs) => {
    yargs
      .positional('path', {
        type: 'string',
        description: '文件或目录路径'
      })
      .option('type', {
        type: 'string',
        description: '资源类型 (note, image, pdf, etc.)'
      })
      .option('category', {
        type: 'string',
        description: '分类（支持多级: 父/子/孙）'
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

  .command('files', '列出可操作文件（resources/ 目录下的文件）', (yargs) => {
    yargs
      .option('type', {
        type: 'string',
        description: '按类型过滤'
      })
      .option('status', {
        type: 'boolean',
        description: '仅显示有状态变更的文件'
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
  }, files)

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

  .command('category <action> [rid] [category]', '管理分类', (yargs) => {
    yargs
      .positional('action', {
        type: 'string',
        choices: ['set', 'rm', 'list', 'tree']
      })
      .positional('rid', {
        type: 'string',
        description: '资源 RID 或文件路径'
      })
      .positional('category', {
        type: 'string',
        description: '分类名称'
      });
  }, category)

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

  .command('unlink <from> <to>', '解除资源链接', (yargs) => {
    yargs
      .positional('from', {
        type: 'string',
        description: '源资源（RID 或路径）'
      })
      .positional('to', {
        type: 'string',
        description: '目标资源（RID 或路径）'
      })
      .option('type', {
        type: 'string',
        description: '链接类型',
        default: 'reference'
      });
  }, unlink)

  .command('relation', '资源关系管理（Phase 5.1）', (yargs) => {
    yargs
      .command('add <from> <to>', '创建关系', (yargs) => {
        yargs
          .positional('from', { type: 'string', description: '源资源（名称或 RID）' })
          .positional('to', { type: 'string', description: '目标资源（名称或 RID）' })
          .option('type', { type: 'string', default: 'reference', description: '关系类型' })
          .option('label', { type: 'string', description: '关系标签' });
      }, relationCmd.add)

      .command('remove <id>', '删除关系（软删除）', (yargs) => {
        yargs
          .positional('id', { type: 'number', description: '关系 id' });
      }, relationCmd.remove)

      .command('list', '列出关系', (yargs) => {
        yargs
          .option('resource', { type: 'string', alias: 'r', description: '按资源筛选' })
          .option('type', { type: 'string', description: '按类型筛选' });
      }, relationCmd.list)

      .command('show <id>', '查看关系详情', (yargs) => {
        yargs
          .positional('id', { type: 'number', description: '关系 id' });
      }, relationCmd.show)

      .demandCommand(1, '请指定关系子命令。可用: add, remove, list, show');
  })

  .command('graph', '资源关系图查询（Phase 5.3）', (yargs) => {
    yargs
      .command('neighbors <resource>', '查询资源的邻居节点', (yargs) => {
        yargs.positional('resource', { type: 'string', description: '资源名称或 RID' });
      }, graphCmd.neighbors)

      .command('backlinks <resource>', '谁引用了这个资源', (yargs) => {
        yargs.positional('resource', { type: 'string', description: '资源名称或 RID' });
      }, graphCmd.backlinks)

      .command('path <from> <to>', '最短路径查询', (yargs) => {
        yargs
          .positional('from', { type: 'string', description: '起始资源' })
          .positional('to', { type: 'string', description: '目标资源' });
      }, graphCmd.path)

      .command('cycles', '检测图中的环', () => {}, graphCmd.cycles)

      .command('export', '导出图（支持 html/svg/json/dot/mermaid/adjacency）', (yargs) => {
        yargs.option('format', {
          type: 'string',
          default: 'json',
          choices: ['json', 'dot', 'mermaid', 'adjacency', 'html', 'svg'],
          description: '导出格式'
        })
        .option('layout', {
          type: 'string',
          default: 'force',
          choices: ['force', 'tree', 'radial'],
          description: '布局算法（html/svg/json 时生效）'
        })
        .option('rid', {
          type: 'string',
          description: '中心资源（邻域视图）'
        })
        .option('depth', {
          type: 'number',
          default: 2,
          description: '邻域深度'
        })
        .option('type', {
          type: 'string',
          description: '关系类型过滤'
        })
        .option('output', {
          type: 'string',
          alias: 'o',
          description: '输出文件路径'
        });
      }, graphCmd.export)

      .command('analyze <type>', '图分析（pagerank/central/isolated/clusters）', (yargs) => {
        yargs
          .positional('type', {
            type: 'string',
            choices: ['pagerank', 'central', 'isolated', 'clusters'],
            description: '分析类型'
          })
          .option('top', { type: 'number', default: 10, description: 'Top N 结果' });
      }, graphCmd.analyze)

      .command('query <resource>', '图查询 DSL', (yargs) => {
        yargs
          .positional('resource', { type: 'string', description: '起始资源' })
          .option('depth', { type: 'number', default: 1, description: '遍历深度' })
          .option('direction', { type: 'string', default: 'both', choices: ['outgoing', 'incoming', 'both'], description: '遍历方向' })
          .option('type', { type: 'string', description: '关系类型过滤' });
      }, graphCmd.query)

      .command('neighborhood <resource>', '资源邻域视图（Phase 5.5）', (yargs) => {
        yargs
          .positional('resource', { type: 'string', description: '资源名称或 RID' })
          .option('depth', { type: 'number', default: 2, description: '探索深度' });
      }, graphCmd.neighborhood)

      .command('explain <a> <b>', '解释两个资源之间的知识路径（Phase 5.5）', (yargs) => {
        yargs
          .positional('a', { type: 'string', description: '起始资源' })
          .positional('b', { type: 'string', description: '目标资源' });
      }, graphCmd.explain)

      .command('query-federated <globalId>', '联邦图查询（Phase 5.10）', (yargs) => {
        yargs
          .positional('globalId', { type: 'string', description: '全局 ID（如 personal:note001）' })
          .option('depth', { type: 'number', default: 3, description: '遍历深度' });
      }, graphCmd.graphQueryFederated)

      .demandCommand(1, '请指定图子命令。可用: neighbors, backlinks, path, cycles, export, analyze, query, neighborhood, explain, query-federated');
  })

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

  .command('sync', '同步资源（本地文件到数据库）', (yargs) => {
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
      })
      .option('wikilinks', {
        type: 'boolean',
        description: '解析并同步所有 .md 文件的 [[...]] 双向链接',
        default: false
      });
  }, sync)

  .command('push <remote>', '推送变更到远程设备', (yargs) => {
    yargs
      .positional('remote', {
        type: 'string',
        description: '远程地址 (user@host:/path 或 /local/path) 或别名'
      })
      .option('full', {
        type: 'boolean',
        description: '修复用：忽略远程清单，全量重推',
        default: false
      });
  }, sync)

  .command('pull <remote>', '从远程设备拉取变更', (yargs) => {
    yargs
      .positional('remote', {
        type: 'string',
        description: '远程地址 (user@host:/path 或 /local/path) 或别名'
      });
  }, sync)

  .command('clone <remote>', '从远程仓库克隆', (yargs) => {
    yargs
      .positional('remote', {
        type: 'string',
        description: '远程地址 (user@host:/path 或 /local/path) 或别名'
      })
      .option('dest', {
        type: 'string',
        description: '克隆目标目录',
        alias: 'd'
      });
  }, sync)

  .command('remote <action> [name] [url]', '管理远程仓库别名', (yargs) => {
    yargs
      .positional('action', {
        type: 'string',
        description: '操作类型',
        choices: ['add', 'remove', 'rm', 'list', 'ls']
      })
      .positional('name', {
        type: 'string',
        description: '远程别名'
      })
      .positional('url', {
        type: 'string',
        description: '远程地址 (user@host:/path 或 /local/path, add 时需要)'
      });
  }, remote)

  .command('manual [command]', '查看命令手册（可指定命令）', (yargs) => {
    yargs
      .positional('command', {
        type: 'string',
        description: '要查看的命令名称（如 new, auth, init 等）'
      });
  }, manual)

  .command('docs [topic]', '查看项目功能详解（加密、认证等）', (yargs) => {
    yargs
      .positional('topic', {
        type: 'string',
        description: '查看的主题（notes, encryption, auth, version, database, security, quickstart）'
      });
  }, docs)

  .command('status', '查看工作区状态', (yargs) => {
    yargs.option('path', {
      type: 'string',
      description: '仓库路径',
      default: process.cwd()
    });
  }, status)

  .command('diff [path]', '显示文件变更差异', (yargs) => {
    yargs
      .positional('path', {
        type: 'string',
        description: '指定文件或目录（留空显示所有变更）'
      });
  }, diff)

  .command('add [path]', '添加文件到暂存区', (yargs) => {
    yargs
      .positional('path', {
        type: 'string',
        description: '文件或目录路径，使用 . 添加所有'
      });
  }, add)

  .command('rm [path]', '暂存文件删除', (yargs) => {
    yargs
      .positional('path', {
        type: 'string',
        description: '要删除的文件路径'
      });
  }, rm)

  .command('create', '创建资源', (yargs) => {
    yargs
      .command('resource <type> <path>', '创建具有 Container Capability 的 Resource', (yargs) => {
        yargs
          .positional('type', {
            type: 'string',
            description: '资源类型',
            choices: ['project', 'album', 'dataset', 'course', 'collection']
          })
          .positional('path', {
            type: 'string',
            description: '内容来源路径（目录）'
          })
          .option('name', {
            type: 'string',
            description: '资源名称（默认使用目录名）'
          })
          .option('no-scan', {
            type: 'boolean',
            description: '跳过自动扫描成员',
            default: false
          });
      }, createResourceCmd)
      .demandCommand(1, '请指定 create 的子命令');
  })

  .command('resource', '资源导航（Phase 5.5）', (yargs) => {
    yargs
      .command('related <resource>', '相关资源推荐', (yargs) => {
        yargs
          .positional('resource', { type: 'string', description: '资源名称或 RID' })
          .option('top', { type: 'number', default: 10, description: '推荐数量' });
      }, graphCmd.related)

      .command('backlinks <resource>', '反向链接（谁引用了我）', (yargs) => {
        yargs
          .positional('resource', { type: 'string', description: '资源名称或 RID' });
      }, graphCmd.resourceBacklinks)

      .command('impact <resource>', '影响分析', (yargs) => {
        yargs
          .positional('resource', { type: 'string', description: '资源名称或 RID' });
      }, graphCmd.impact)

      .demandCommand(1, '请指定资源子命令。可用: related, backlinks, impact');
  })

  .command('knowledge', '知识智能（Phase 5.7）', (yargs) => {
    yargs
      .command('analyze', '知识分析报告（密度、孤岛、缺口）', {}, graphCmd.knowledgeAnalyze)

      .command('gaps', '知识缺口检测', {}, graphCmd.knowledgeGaps)

      .command('recommend <resource>', '智能推荐（关联知识 + 下一步学习）', (yargs) => {
        yargs
          .positional('resource', { type: 'string', description: '资源名称或 RID' })
          .option('top', { type: 'number', default: 10, description: '推荐数量' });
      }, graphCmd.knowledgeRecommend)

      .command('timeline', '知识演化时间线', {}, graphCmd.knowledgeTimeline)

      .command('lifecycle', '知识生命周期状态', {}, graphCmd.knowledgeLifecycle)

      .command('repair', '知识修复诊断（断裂关系/孤立资源/重复资源）', {}, graphCmd.knowledgeRepairDiagnosis)

      .command('ai', 'AI 知识助手', (yargs) => {
        yargs
          .command('explain <resource>', 'AI 解释资源位置', (yargs) => {
            yargs.positional('resource', { type: 'string', description: '资源名称或 RID' });
          }, graphCmd.knowledgeAIExplain)

          .command('summarize <resource>', 'AI 为资源生成摘要', (yargs) => {
            yargs.positional('resource', { type: 'string', description: '资源名称或 RID' });
          }, graphCmd.knowledgeAISummarize)

          .command('ask [query]', 'AI 知识问答', (yargs) => {
            yargs
              .positional('query', { type: 'string', description: '问题（如"缺什么"、"核心节点"、"推荐"）', default: 'overview' });
          }, graphCmd.knowledgeAIAsk)

          .demandCommand(1, '请指定 AI 子命令。可用: explain, summarize, ask');
      })

      .demandCommand(1, '请指定知识子命令。可用: analyze, gaps, recommend, timeline, lifecycle, repair, ai');
  })

  .command('suggestion', 'AI 建议管理（Phase 5.8）', (yargs) => {
    yargs
      .command('list', '查看建议列表', (yargs) => {
        yargs.option('status', { type: 'string', description: '过滤状态: pending/approved/rejected' });
      }, graphCmd.suggestionList)

      .command('approve <id>', '批准 AI 建议', (yargs) => {
        yargs.positional('id', { type: 'string', description: 'Suggestion ID' });
      }, graphCmd.suggestionApprove)

      .command('execute <id>', '执行已批准的建议（创建 relation）', (yargs) => {
        yargs.positional('id', { type: 'string', description: 'Suggestion ID' });
      }, graphCmd.suggestionExecute)

      .command('reject <id>', '拒绝 AI 建议', (yargs) => {
        yargs.positional('id', { type: 'string', description: 'Suggestion ID' });
      }, graphCmd.suggestionReject)

      .demandCommand(1, '请指定建议子命令。可用: list, approve, execute, reject');
  })

  .command('automation', '知识自动化（Phase 5.9）', (yargs) => {
    yargs
      .command('run', '运行完整自动化管线（lifecycle + repair + suggestion）', {}, graphCmd.automationRun)

      .demandCommand(1, '请指定自动化子命令。可用: run');
  })

  .command('federation', '联邦仓库管理（Phase 5.10）', (yargs) => {
    yargs
      .command('list', '列出已注册的联邦仓库', {}, graphCmd.federationList)

      .command('add <path>', '注册联邦仓库', (yargs) => {
        yargs
          .positional('path', { type: 'string', description: '仓库路径' })
          .option('namespace', { type: 'string', demandOption: true, description: '命名空间' })
          .option('name', { type: 'string', description: '显示名称' });
      }, graphCmd.federationAdd)

      .command('remove <namespace>', '移除联邦仓库', (yargs) => {
        yargs.positional('namespace', { type: 'string', description: '命名空间或名称' });
      }, graphCmd.federationRemove)

      .demandCommand(1, '请指定联邦子命令。可用: list, add, remove');
  })

  .command('sync', '知识同步（Phase 5.10）', (yargs) => {
    yargs
      .command('pull <namespace>', '从远程仓库拉取资源', (yargs) => {
        yargs.positional('namespace', { type: 'string', description: '远程 namespace' });
      }, graphCmd.syncPull)

      .command('push <namespace>', '推送本地资源到远程仓库', (yargs) => {
        yargs.positional('namespace', { type: 'string', description: '远程 namespace' });
      }, graphCmd.syncPush)

      .command('status', '查看同步状态', {}, graphCmd.syncStatus)

      .command('conflict', '冲突管理', (yargs) => {
        yargs
          .command('list', '列出待解决冲突', {}, graphCmd.syncConflictList)
          .command('resolve <id> <strategy>', '解决冲突', (yargs) => {
            yargs
              .positional('id', { type: 'string', description: 'Conflict ID' })
              .positional('strategy', { type: 'string', description: 'local-win | remote-win | manual' });
          }, graphCmd.syncConflictResolve)
          .demandCommand(1, '请指定冲突子命令。可用: list, resolve');
      })

      .demandCommand(1, '请指定同步子命令。可用: pull, push, status, conflict');
  })

  .command('container', '容器管理（提升/降级、状态、扫描、同步、列表、成员、忽略）', (yargs) => {
    yargs
      .command('promote [path]', '提升容器成员为独立 Resource（--revert 降级）', (yargs) => {
        yargs
          .positional('path', {
            type: 'string',
            description: '要操作的文件路径'
          })
          .option('container', {
            type: 'string',
            alias: 'c',
            description: '容器名称或 RID（不指定则自动查找）'
          })
          .option('type', {
            type: 'string',
            alias: 't',
            description: 'Resource 类型（仅提升时生效，默认根据文件扩展名推导）'
          })
          .option('revert', {
            type: 'boolean',
            alias: 'r',
            description: '降级：将已提升成员恢复为普通文件成员',
            default: false
          });
      }, containerCmd.promote)

      .command('status [containerId]', '查看容器成员变更状态（对比文件系统与数据库）', (yargs) => {
        yargs
          .positional('containerId', {
            type: 'string',
            description: '容器名称或 RID'
          });
      }, containerCmd.status)

      .command('scan [containerId]', '扫描容器成员（添加新文件）', (yargs) => {
        yargs
          .positional('containerId', {
            type: 'string',
            description: '容器名称或 RID'
          });
      }, containerCmd.scan)

      .command('sync [containerId]', '同步容器成员（diff + 应用变更：新增/修改/删除）', (yargs) => {
        yargs
          .positional('containerId', {
            type: 'string',
            description: '容器名称或 RID'
          })
          .option('dry-run', {
            type: 'boolean',
            alias: 'n',
            description: '仅预览变更，不实际修改数据库',
            default: false
          });
      }, containerCmd.sync)

      .command('list [containerId]', '列出容器所有成员', (yargs) => {
        yargs
          .positional('containerId', {
            type: 'string',
            description: '容器名称或 RID'
          })
          .option('resources', {
            type: 'boolean',
            description: '仅显示已提升为 Resource 的成员',
            default: false
          })
          .option('files', {
            type: 'boolean',
            description: '仅显示未提升的普通文件成员',
            default: false
          });
      }, containerCmd.list)

      .command('members [containerId]', '列出容器成员（带状态图标：promoted/indexed/force-ignored/deleted）', (yargs) => {
        yargs
          .positional('containerId', {
            type: 'string',
            description: '容器名称或 RID'
          })
          .option('promoted', {
            type: 'boolean',
            description: '仅显示已提升成员',
            default: false
          })
          .option('indexed', {
            type: 'boolean',
            description: '仅显示未提升的普通成员',
            default: false
          });
      }, containerCmd.members)

      .command('config [containerId]', '查看容器同步配置（source / sync_mode / delete_policy）', (yargs) => {
        yargs
          .positional('containerId', {
            type: 'string',
            description: '容器名称或 RID'
          });
      }, containerCmd.config)

      .command('ignore [path]', '强制忽略容器成员（设置 force_ignore 标志）', (yargs) => {
        yargs
          .positional('path', {
            type: 'string',
            description: '要忽略的文件路径'
          })
          .option('container', {
            type: 'string',
            alias: 'c',
            description: '容器名称或 RID（不指定则自动查找）'
          })
          .option('source', {
            type: 'number',
            alias: 's',
            description: 'Content Source ID（多 source 时指定）'
          });
      }, containerCmd.ignore)

      .command('unignore [path]', '取消忽略容器成员', (yargs) => {
        yargs
          .positional('path', {
            type: 'string',
            description: '要取消忽略的文件路径'
          })
          .option('container', {
            type: 'string',
            alias: 'c',
            description: '容器名称或 RID（不指定则自动查找）'
          })
          .option('source', {
            type: 'number',
            alias: 's',
            description: 'Content Source ID（多 source 时指定）'
          });
      }, containerCmd.unignore)

      // ── Phase 4.1: lo container member <action> ──
      .command('member', '成员操作（rename/remove/restore/move/copy）', (yargs) => {
        yargs
          .command('rename <path> <newpath>', '重命名成员路径', (yargs) => {
            yargs
              .positional('path', { type: 'string', description: '当前成员路径' })
              .positional('newpath', { type: 'string', description: '新路径' })
              .option('container', { type: 'string', alias: 'c', description: '容器名称或 RID' });
          }, containerCmd.memberRename)

          .command('remove <path>', '软删除成员（status→deleted）', (yargs) => {
            yargs
              .positional('path', { type: 'string', description: '成员路径' })
              .option('container', { type: 'string', alias: 'c', description: '容器名称或 RID' });
          }, containerCmd.memberRemove)

          .command('restore <path>', '恢复已删除的成员', (yargs) => {
            yargs
              .positional('path', { type: 'string', description: '成员路径' })
              .option('container', { type: 'string', alias: 'c', description: '容器名称或 RID' });
          }, containerCmd.memberRestore)

          .command('move <path> <target>', '移动成员到另一个容器', (yargs) => {
            yargs
              .positional('path', { type: 'string', description: '成员路径' })
              .positional('target', { type: 'string', description: '目标容器名称或 RID' })
              .option('container', { type: 'string', alias: 'c', description: '源容器名称或 RID' });
          }, containerCmd.memberMove)

          .command('copy <path> <target>', '复制成员到另一个容器', (yargs) => {
            yargs
              .positional('path', { type: 'string', description: '成员路径' })
              .positional('target', { type: 'string', description: '目标容器名称或 RID' })
              .option('container', { type: 'string', alias: 'c', description: '源容器名称或 RID' });
          }, containerCmd.memberCopy)

          .command('history <path>', '查看成员操作历史', (yargs) => {
            yargs
              .positional('path', { type: 'string', description: '成员路径' })
              .option('container', { type: 'string', alias: 'c', description: '容器名称或 RID' });
          }, containerCmd.memberHistory)

          .demandCommand(1, '请指定成员操作。可用: rename, remove, restore, move, copy, history');
      })

      .command('history', '查看容器操作时间线', (yargs) => {
        yargs
          .option('container', { type: 'string', alias: 'c', description: '容器名称或 RID' })
          .option('limit', { type: 'number', default: 50, description: '显示条数' });
      }, containerCmd.containerHistory)

      .command('transaction', '事务管理（list/show/undo）', (yargs) => {
        yargs
          .command('list <container>', '列出容器的事务', (yargs) => {
            yargs
              .positional('container', { type: 'string', description: '容器名称或 RID' })
              .option('limit', { type: 'number', default: 50, description: '显示条数' });
          }, containerCmd.transactionList)

          .command('show <transaction>', '查看事务详情', (yargs) => {
            yargs
              .positional('transaction', { type: 'string', description: '事务 ID (tx_xxx)' });
          }, containerCmd.transactionShow)

          .command('undo <transaction>', '回滚事务（逆序撤销所有操作）', (yargs) => {
            yargs
              .positional('transaction', { type: 'string', description: '事务 ID (tx_xxx)' });
          }, containerCmd.transactionUndo)

          .demandCommand(1, '请指定事务操作。可用: list, show, undo');
      })

      .command('verify <container>', '检查容器数据一致性（Member/Operation/Transaction）', (yargs) => {
        yargs
          .positional('container', { type: 'string', description: '容器名称或 RID' });
      }, containerCmd.verify)

      .demandCommand(1, '请指定容器子命令。可用: promote, status, scan, sync, list, members, config, ignore, unignore, member, history, transaction, verify');
  })

  .command('commit', '提交暂存区到仓库', (yargs) => {
    yargs
      .option('message', {
        type: 'string',
        alias: 'm',
        description: '提交信息'
      })
      .option('merge', {
        type: 'boolean',
        description: '标记为合并提交（自动检测，也可手动指定）'
      });
  }, commit)

  // Phase 4.2: undo container operation
  .command('undo <operation>', '撤销容器操作', (yargs) => {
    yargs
      .positional('operation', {
        type: 'string',
        description: '操作 ID（通过 lo container member history 查看）'
      });
  }, containerCmd.undo)

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

  .command('stack [action] [name] [layer]', '管理资源栈（同名冲突的冗余副本）', (yargs) => {
    yargs
      .positional('action', {
        type: 'string',
        description: '栈操作',
        choices: ['list', 'pop', 'drop']
      })
      .positional('name', {
        type: 'string',
        description: '资源名称'
      })
      .positional('layer', {
        type: 'number',
        description: '栈层级（用于 drop）'
      });
  }, stack)

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
  }, auth)
  
  .command('serve', '启动本地 HTTP API 服务', (yargs) => {
    yargs
      .option('port', {
        type: 'number',
        alias: 'p',
        description: '监听端口',
        default: 8765
      })
      .option('repo', {
        type: 'string',
        alias: 'r',
        description: '仓库路径',
        default: process.cwd()
      });
  }, serve)

  .command('operation', '操作管理', (yargs) => {
    yargs
      .command('types', '列出所有已注册的操作类型', {}, async (argv) => {
        const Repository = require('./repo/repository.cjs');
        const repo = new Repository(process.cwd());
        await repo.open({ skipAuth: true });
        const types = repo.getOperationTypes();
        console.log(chalk.bold.cyan('\n  Registered Operations:\n'));
        for (const t of types) {
          console.log(`  ${chalk.gray('·')} ${chalk.cyan(t)}`);
        }
        console.log(chalk.gray(`\n  ${types.length} types total`));
        console.log('');
        await repo.close();
        process.exit(0);
      })
      .demandCommand(1, '请指定操作子命令。可用: types');
  });

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