/**
 * lo graph — Resource Relation Graph CLI
 * Phase 5.3
 */

const chalk = require('chalk');
const path = require('path');
const Logger = require('../utils/logger.cjs');
const Repository = require('../repo/repository.cjs');

async function neighborsHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const res = await repo.resolveResource(argv.resource);
    if (!res) {
      Logger.error(`资源不存在: ${argv.resource}`);
      await repo.close();
      process.exit(1);
    }

    const list = await repo.getNeighbors(res.rid);

    console.log(chalk.bold.cyan(`\n  Neighbors of: ${res.rid}`));
    console.log(chalk.gray(`  ${list.length} neighbors\n`));

    if (list.length === 0) {
      console.log(chalk.gray('  (无邻居)'));
    } else {
      for (const rid of list) {
        console.log(`  ${chalk.cyan(rid)}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`查询邻居失败: ${error.message}`);
    process.exit(1);
  }
}

async function backlinksHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const res = await repo.resolveResource(argv.resource);
    if (!res) {
      Logger.error(`资源不存在: ${argv.resource}`);
      await repo.close();
      process.exit(1);
    }

    const list = await repo.getBacklinks(res.rid);

    console.log(chalk.bold.cyan(`\n  Backlinks to: ${res.rid}`));
    console.log(chalk.gray(`  ${list.length} backlinks\n`));

    if (list.length === 0) {
      console.log(chalk.gray('  (无反向链接)'));
    } else {
      for (const rid of list) {
        console.log(`  ${chalk.cyan(rid)} → ${chalk.yellow(res.rid)}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`查询反向链接失败: ${error.message}`);
    process.exit(1);
  }
}

async function pathHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const fromRes = await repo.resolveResource(argv.from);
    const toRes = await repo.resolveResource(argv.to);

    if (!fromRes) {
      Logger.error(`源资源不存在: ${argv.from}`);
      await repo.close();
      process.exit(1);
    }
    if (!toRes) {
      Logger.error(`目标资源不存在: ${argv.to}`);
      await repo.close();
      process.exit(1);
    }

    const result = await repo.findPath(fromRes.rid, toRes.rid);

    console.log(chalk.bold.cyan(`\n  Path: ${fromRes.rid} → ${toRes.rid}`));

    if (!result) {
      console.log(chalk.gray('\n  (无路径可达)'));
    } else {
      console.log(chalk.gray(`\n  Length: ${result.length}`));
      for (let i = 0; i < result.path.length; i++) {
        const indent = '  '.repeat(i);
        console.log(`${indent}${i === 0 ? chalk.cyan(result.path[i]) : '├── ' + chalk.cyan(result.path[i])}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`查询路径失败: ${error.message}`);
    process.exit(1);
  }
}

async function cyclesHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const cycles = await repo.detectCycles();

    console.log(chalk.bold.cyan(`\n  Cycle Detection`));
    console.log(chalk.gray(`  ${cycles.length} cycles found\n`));

    if (cycles.length === 0) {
      console.log(chalk.green('  No cycles detected.'));
    } else {
      for (let i = 0; i < cycles.length; i++) {
        const path = cycles[i].map(n => chalk.cyan(n)).join(chalk.red(' → '));
        console.log(`  ${chalk.red('⟳')}  ${path}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`环检测失败: ${error.message}`);
    process.exit(1);
  }
}

async function exportHandler(argv) {
  const { format = 'json', layout = 'force', rid, depth, type: relType, output } = argv;

  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    // Phase 5.6: 使用新的 visual exporter（支持 html/svg/json + layout）
    if (format === 'html' || format === 'svg' || (format === 'json' && (rid || relType || layout !== 'force'))) {
      const result = await repo.exportVisualGraph({
        format, layout, rid,
        depth: depth || 2,
        type: relType
      });

      if (output) {
        const fs = require('fs-extra');
        await fs.writeFile(output, result, 'utf-8');
        console.log(chalk.green(`\n  Exported to: ${output}`));
        console.log(chalk.gray(`  format: ${format}  layout: ${layout}`));
        if (rid) console.log(chalk.gray(`  center: ${rid}  depth: ${depth || 2}`));
      } else {
        console.log(result);
      }
    } else {
      // Legacy: Phase 5.3 格式 (dot/mermaid/adjacency + simple json)
      const result = await repo.exportGraph(format);

      if (output) {
        const fs = require('fs-extra');
        await fs.writeFile(output, result, 'utf-8');
        console.log(chalk.green(`\n  Exported to: ${output}`));
      } else {
        console.log(result);
      }
    }

    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`导出失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Phase 5.4: lo graph analyze
 */
async function analyzeHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const { type, top } = argv;

    switch (type) {
      case 'pagerank': {
        const pr = await repo.getPageRank({ iterations: 20, damping: 0.85 });
        console.log(chalk.bold.cyan(`\n  PageRank (Top ${Math.min(pr.length, top || 10)})`));
        console.log(chalk.gray(`  ${pr.length} nodes total\n`));
        for (let i = 0; i < Math.min(pr.length, top || 10); i++) {
          const r = pr[i];
          console.log(`  ${chalk.yellow(i + 1)}.  ${chalk.cyan(r.rid)}  ${chalk.gray(r.score.toFixed(4))}`);
        }
        console.log('');
        break;
      }

      case 'central': {
        const central = await repo.getCentralNodes(top || 10);
        console.log(chalk.bold.cyan(`\n  Central Nodes (Top ${central.length})`));
        console.log(chalk.gray(`  ranked by degree (incoming + outgoing)\n`));
        for (let i = 0; i < central.length; i++) {
          const c = central[i];
          console.log(`  ${chalk.yellow(i + 1)}.  ${chalk.cyan(c.rid)}  deg=${c.degree}  (in=${c.incoming}, out=${c.outgoing})`);
        }
        console.log('');
        break;
      }

      case 'isolated': {
        const iso = await repo.getIsolatedNodes();
        console.log(chalk.bold.cyan(`\n  Isolated Nodes`));
        console.log(chalk.gray(`  ${iso.length} isolated nodes\n`));
        if (iso.length === 0) {
          console.log(chalk.green('  No isolated nodes — graph is fully connected.'));
        } else {
          for (const rid of iso.slice(0, 50)) {
            console.log(`  ${chalk.yellow(rid)}`);
          }
          if (iso.length > 50) {
            console.log(chalk.gray(`  ... and ${iso.length - 50} more`));
          }
        }
        console.log('');
        break;
      }

      case 'clusters': {
        const cl = await repo.getClusters();
        console.log(chalk.bold.cyan(`\n  Graph Clusters`));
        console.log(chalk.gray(`  ${cl.length} clusters\n`));
        for (const c of cl.slice(0, 10)) {
          console.log(`  ${chalk.yellow(`Cluster #${c.id}`)}  size=${c.size}  ${chalk.gray(c.nodes.slice(0, 5).join(', ') + (c.nodes.length > 5 ? '...' : ''))}`);
        }
        if (cl.length > 10) {
          console.log(chalk.gray(`  ... and ${cl.length - 10} more clusters`));
        }
        console.log('');
        break;
      }

      default:
        Logger.error(`未知分析类型: ${type}。可用: pagerank, central, isolated, clusters`);
        process.exit(1);
    }

    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`分析失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Phase 5.4: lo graph query
 */
async function queryHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const res = await repo.resolveResource(argv.resource);
    if (!res) {
      Logger.error(`资源不存在: ${argv.resource}`);
      await repo.close();
      process.exit(1);
    }

    const { depth = 1, direction = 'both', type: relType } = argv;

    const builder = await (await repo.queryGraph().from(res.rid));

    if (direction === 'outgoing') builder.outgoing();
    else if (direction === 'incoming') builder.incoming();
    else builder.both();

    if (depth > 0) builder.depth(depth);
    if (relType) builder.type(relType);

    const results = builder.run();

    console.log(chalk.bold.cyan(`\n  Graph Query: ${res.rid}`));
    console.log(chalk.gray(`  depth=${depth}  dir=${direction}  ${relType ? 'type=' + relType : ''}`));
    console.log(chalk.gray(`  ${results.length} results\n`));

    if (results.length === 0) {
      console.log(chalk.gray('  (无匹配节点)'));
    } else {
      for (const r of results) {
        const dist = '  '.repeat(r.distance);
        console.log(`${dist}${chalk.cyan(r.rid)}  ${chalk.gray(`(dist=${r.distance}, deg=${r.degree})`)}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`查询失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Phase 5.5: lo graph neighborhood
 */
async function neighborhoodHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const res = await repo.resolveResource(argv.resource);
    if (!res) {
      Logger.error(`资源不存在: ${argv.resource}`);
      await repo.close();
      process.exit(1);
    }

    const { depth = 2 } = argv;
    const result = await repo.getResourceNeighborhood(res.rid, depth);

    console.log(chalk.bold.cyan(`\n  Neighborhood of: ${res.rid}`));
    if (res.name) console.log(chalk.gray(`  ${res.name}`));
    console.log(chalk.gray(`  depth=${result.depth}  nodes=${result.nodes.length}  edges=${result.edges.length}\n`));

    if (result.nodes.length === 0) {
      console.log(chalk.gray('  (无邻居节点)'));
    } else {
      // 构建节点名称映射
      const nameMap = new Map();
      nameMap.set(res.rid, res.name || res.rid);
      for (const rid of result.nodes) {
        try {
          const r = await repo.getResource(rid);
          nameMap.set(rid, r ? (r.name || rid) : rid);
        } catch { nameMap.set(rid, rid); }
      }

      console.log(chalk.bold('  Nodes:'));
      console.log(`  ${chalk.cyan('(center)')} ${nameMap.get(res.rid)}`);
      for (const rid of result.nodes) {
        console.log(`    ${chalk.cyan(rid)}  ${chalk.gray(nameMap.get(rid))}`);
      }

      console.log(chalk.bold('\n  Edges:'));
      for (const e of result.edges) {
        const fromName = nameMap.get(e.from) || e.from;
        const toName = nameMap.get(e.to) || e.to;
        console.log(`    ${chalk.yellow(fromName)} ${chalk.gray('--[' + e.type + ']-->')} ${chalk.yellow(toName)}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`邻域查询失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Phase 5.5: lo graph explain
 */
async function explainHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const fromRes = await repo.resolveResource(argv.a);
    const toRes = await repo.resolveResource(argv.b);

    if (!fromRes) {
      Logger.error(`资源不存在: ${argv.a}`);
      await repo.close();
      process.exit(1);
    }
    if (!toRes) {
      Logger.error(`资源不存在: ${argv.b}`);
      await repo.close();
      process.exit(1);
    }

    const result = await repo.getExplainPath(fromRes.rid, toRes.rid);

    console.log(chalk.bold.cyan(`\n  Knowledge Path: ${fromRes.rid} → ${toRes.rid}`));

    if (!result) {
      console.log(chalk.gray('\n  (无路径可达)'));
    } else {
      console.log(chalk.gray(`\n  Length: ${result.length} steps`));
      console.log('');
      for (let i = 0; i < result.explanation.length; i++) {
        const step = i + 1;
        console.log(`  ${chalk.yellow(step)}.  ${result.explanation[i]}`);
      }
      console.log('');
      console.log(chalk.green(`  ${result.path[0]}  ──→  ${result.path[result.path.length - 1]}`));
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`路径解释失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Phase 5.5: lo resource related
 */
async function relatedHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const res = await repo.resolveResource(argv.resource);
    if (!res) {
      Logger.error(`资源不存在: ${argv.resource}`);
      await repo.close();
      process.exit(1);
    }

    const { top = 10 } = argv;
    const results = await repo.getRelatedResources(res.rid, { topN: top });

    console.log(chalk.bold.cyan(`\n  Related to: ${res.rid}`));
    if (res.name) console.log(chalk.gray(`  ${res.name}`));
    console.log(chalk.gray(`  ${results.length} recommendations\n`));

    if (results.length === 0) {
      console.log(chalk.gray('  (无相关推荐)'));
    } else {
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        let name = r.rid;
        try {
          const resource = await repo.getResource(r.rid);
          if (resource) name = resource.name || r.rid;
        } catch {}

        console.log(`  ${chalk.yellow(i + 1)}.  ${chalk.cyan(r.rid)}  ${chalk.gray(name)}`);
        console.log(`       score=${r.score}  shared=${r.sharedNeighbors}  pr=${r.pageRank}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`相关推荐失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Phase 5.5: lo resource backlinks
 */
async function resourceBacklinksHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const res = await repo.resolveResource(argv.resource);
    if (!res) {
      Logger.error(`资源不存在: ${argv.resource}`);
      await repo.close();
      process.exit(1);
    }

    const results = await repo.getBacklinkDetails(res.rid);

    console.log(chalk.bold.cyan(`\n  Backlinks to: ${res.rid}`));
    if (res.name) console.log(chalk.gray(`  ${res.name}`));
    console.log(chalk.gray(`  ${results.length} backlinks\n`));

    if (results.length === 0) {
      console.log(chalk.gray('  (无反向链接)'));
    } else {
      for (const bl of results) {
        let name = bl.rid;
        try {
          const resource = await repo.getResource(bl.rid);
          if (resource) name = resource.name || bl.rid;
        } catch {}

        console.log(`  ${chalk.cyan(bl.rid)}  ${chalk.gray(name)}  ${chalk.yellow('[' + bl.type + ']')}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`反向链接查询失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Phase 5.7: lo resource impact
 */
async function impactHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const res = await repo.resolveResource(argv.resource);
    if (!res) {
      Logger.error(`资源不存在: ${argv.resource}`);
      await repo.close();
      process.exit(1);
    }

    const result = await repo.analyzeImpact(res.rid);

    console.log(chalk.bold.cyan(`\n  Impact Analysis: ${res.rid}`));
    if (res.name) console.log(chalk.gray(`  ${res.name}`));
    console.log(chalk.gray(`  impact score: ${result.score}`));
    console.log(chalk.gray(`  total impacted: ${result.totalImpacted} (direct=${result.direct}, indirect=${result.indirect})\n`));

    if (result.totalImpacted === 0) {
      console.log(chalk.green('  No resources depend on this — safe to modify.'));
    } else {
      if (result.directList.length > 0) {
        console.log(chalk.bold(`  Direct (${result.direct}):`));
        for (const d of result.directList) {
          let name = d.rid;
          try { const r = await repo.getResource(d.rid); if (r) name = r.name || d.rid; } catch {}
          console.log(`    ${chalk.cyan(d.rid)}  ${chalk.gray(name)}  ${chalk.yellow('[' + d.type + ']')}`);
        }
      }

      if (result.indirectList.length > 0) {
        console.log(chalk.bold(`\n  Indirect (${result.indirect}):`));
        for (const rid of result.indirectList.slice(0, 20)) {
          let name = rid;
          try { const r = await repo.getResource(rid); if (r) name = r.name || rid; } catch {}
          console.log(`    ${chalk.cyan(rid)}  ${chalk.gray(name)}`);
        }
        if (result.indirectList.length > 20) {
          console.log(chalk.gray(`    ... and ${result.indirectList.length - 20} more`));
        }
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`影响分析失败: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════ Phase 5.7: Knowledge Intelligence Handlers ═══════════

/**
 * lo knowledge analyze
 */
async function knowledgeAnalyzeHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const report = await repo.analyzeKnowledge();
    const { density, clusters, gaps } = report;

    console.log(chalk.bold.cyan('\n  Knowledge Report'));
    console.log(chalk.gray('  ───────────────────────────────\n'));
    console.log(`  ${chalk.bold('Resources:')}  ${density.resources}`);
    console.log(`  ${chalk.bold('Relations:')}  ${density.relations}`);
    console.log(`  ${chalk.bold('Density:')}    ${density.density}  ${chalk.gray('(' + density.level + ')')}`);
    console.log('');
    console.log(`  ${chalk.bold('Clusters:')}   ${clusters.total}`);
    console.log(`    ${chalk.green('core:')}     ${clusters.core || 0}`);
    console.log(`    ${chalk.yellow('isolated:')} ${clusters.isolated || 0}`);
    console.log(`    ${chalk.gray('largest:')}  ${clusters.largest}`);

    if (clusters.isolated > 0) {
      console.log(chalk.yellow(`\n  ${clusters.isolated} isolated resource(s) detected — run "lo knowledge gaps" for details.`));
    }

    if (gaps && gaps.length > 0) {
      console.log(chalk.cyan(`\n  ${gaps.length} potential knowledge gap(s) found.`));
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`知识分析失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo knowledge gaps
 */
async function knowledgeGapsHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const gaps = await repo.findKnowledgeGaps({ maxGaps: 10 });

    console.log(chalk.bold.cyan('\n  Knowledge Gaps'));
    console.log(chalk.gray('  ───────────────────────────────'));

    if (gaps.length === 0) {
      console.log(chalk.green('\n  No significant gaps found.'));
    } else {
      for (let i = 0; i < gaps.length; i++) {
        const g = gaps[i];
        console.log(chalk.bold(`\n  ${i + 1}. Bridge: ${g.fromCluster} ↔ ${g.toCluster}`));
        console.log(`    ${chalk.cyan(g.from)}  ${chalk.gray('···')}  ${chalk.cyan(g.to)}`);
        if (g.sharedNeighbors.length > 0) {
          console.log(chalk.gray(`    shared: ${g.sharedNeighbors.slice(0, 3).join(', ')}`));
        }
        console.log(chalk.yellow(`    suggested bridge: ${g.suggested}`));
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`缺口检测失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo knowledge recommend
 */
async function knowledgeRecommendHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const res = await repo.resolveResource(argv.resource);
    if (!res) {
      Logger.error(`资源不存在: ${argv.resource}`);
      await repo.close();
      process.exit(1);
    }

    const { top = 10 } = argv;
    const related = await repo.getRecommendations(res.rid, { topN: top });
    const next = await repo.getNextLearning(res.rid, { topN: 5 });

    console.log(chalk.bold.cyan(`\n  Recommendations for: ${res.rid}`));
    if (res.name) console.log(chalk.gray(`  ${res.name}`));
    console.log(chalk.gray('  ───────────────────────────────'));

    if (related.length > 0) {
      console.log(chalk.bold(`\n  Related Knowledge (${related.length}):`));
      for (let i = 0; i < related.length; i++) {
        const r = related[i];
        let name = r.rid;
        try { const resource = await repo.getResource(r.rid); if (resource) name = resource.name || r.rid; } catch {}
        console.log(`  ${chalk.yellow(i + 1)}. ${chalk.cyan(r.rid)}  ${chalk.gray(name)}`);
        console.log(`     ${chalk.gray(r.reason)}  score=${r.score}  rank=${r.rank}`);
      }
    }

    if (next.length > 0) {
      console.log(chalk.bold(`\n  Next to Learn (${next.length}):`));
      for (let i = 0; i < next.length; i++) {
        const r = next[i];
        let name = r.rid;
        try { const resource = await repo.getResource(r.rid); if (resource) name = resource.name || r.rid; } catch {}
        console.log(`  ${chalk.green(i + 1)}. ${chalk.cyan(r.rid)}  ${chalk.gray(name)}`);
        console.log(`     ${chalk.gray(r.reason)}  links=${r.linkCount}`);
      }
    }

    if (related.length === 0 && next.length === 0) {
      console.log(chalk.gray('\n  No recommendations available for this resource.'));
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`推荐失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo knowledge timeline
 */
async function knowledgeTimelineHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const { monthly, growth, activity } = await repo.getKnowledgeTimeline();

    console.log(chalk.bold.cyan('\n  Knowledge Timeline'));
    console.log(chalk.gray('  ───────────────────────────────\n'));
    console.log(`  ${chalk.bold('Total Operations:')}  ${growth.total}`);
    console.log(`  ${chalk.bold('Total Linked:')}     ${growth.linked || 0}`);
    console.log(`  ${chalk.bold('Months Tracked:')}  ${growth.months}`);
    console.log(`  ${chalk.bold('Link Rate:')}       ${growth.rate}/month`);
    console.log(`  ${chalk.bold('Trend:')}          ${activity.trend}`);

    if (monthly.length > 0) {
      console.log(chalk.bold('\n  By Month:'));
      for (const m of monthly.slice(-12)) {
        const bar = '█'.repeat(Math.min(m.linked || 0, 40));
        console.log(`  ${chalk.cyan(m.month)}  ${chalk.yellow(bar)}  +${m.linked || 0} linked  (${m.total} ops)`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`时间线生成失败: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════ Phase 5.8: Suggestion Handlers ═══════════

async function suggestionListHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const { status } = argv;
    const stats = await repo.getSuggestionStats();
    const suggestions = await repo.listSuggestions({ status, limit: 50 });

    console.log(chalk.bold.cyan('\n  AI Suggestions'));
    console.log(chalk.gray(`  pending: ${stats.pending} | approved: ${stats.approved} | rejected: ${stats.rejected}`));
    console.log(chalk.gray('  ───────────────────────────────'));

    const display = status ? suggestions : suggestions.filter(s => s.status === 'pending');
    if (display.length === 0) {
      console.log(chalk.gray(status ? `\n  No ${status} suggestions.` : '\n  No pending suggestions.'));
    } else {
      for (const s of display) {
        const icon = s.status === 'approved' ? chalk.green('✓') : s.status === 'rejected' ? chalk.red('✗') : chalk.yellow('?');
        console.log(chalk.bold(`\n  ${icon} [${s.id}]  ${s.status}`));
        console.log(`    ${chalk.cyan(s.source)}  ${chalk.gray('→')}  ${chalk.cyan(s.target)}`);
        console.log(`    type: ${chalk.yellow((s.payload && s.payload.suggestedType) || 'reference')}  confidence: ${s.confidence}`);
        console.log(`    ${chalk.gray(s.reason)}`);
      }
    }

    if (stats.pending > 0) {
      console.log(chalk.gray('\n  Use "lo suggestion approve <id>" or "lo suggestion reject <id>"'));
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`建议列表查询失败: ${error.message}`);
    process.exit(1);
  }
}

async function suggestionApproveHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const suggestion = await repo.approveSuggestion(argv.id);
    console.log(chalk.green(`\n  Approved: ${suggestion.id}`));
    console.log(chalk.gray(`  ${suggestion.source} → ${suggestion.target}`));
    console.log(chalk.gray(`  Run "lo suggestion execute ${suggestion.id}" to apply.`));
    console.log('');

    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`审批失败: ${error.message}`);
    process.exit(1);
  }
}

async function suggestionExecuteHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const result = await repo.executeApprovedSuggestion(argv.id);
    console.log(chalk.green(`\n  Executed: relation ${result.type} created`));
    console.log(chalk.gray(`  ${result.from_rid} → ${result.to_rid}`));
    console.log('');

    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`执行失败: ${error.message}`);
    process.exit(1);
  }
}

async function suggestionRejectHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    await repo.rejectSuggestion(argv.id);
    console.log(chalk.yellow(`\n  Rejected: ${argv.id}`));
    console.log('');

    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`拒绝失败: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════ Phase 5.8: AI Knowledge Handlers ═══════════

async function knowledgeAIExplainHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const res = await repo.resolveResource(argv.resource);
    if (!res) {
      Logger.error(`资源不存在: ${argv.resource}`);
      await repo.close();
      process.exit(1);
    }

    const result = await repo.explainWithAI(res.rid);
    if (!result) {
      console.log(chalk.gray('\n  No context available for this resource.'));
    } else {
      console.log(chalk.bold.cyan('\n  AI Explanation'));
      console.log(chalk.gray('  ───────────────────────────────'));
      console.log('');
      console.log(result.text);
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`AI 解释失败: ${error.message}`);
    process.exit(1);
  }
}

async function knowledgeAISummarizeHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const res = await repo.resolveResource(argv.resource);
    if (!res) {
      Logger.error(`资源不存在: ${argv.resource}`);
      await repo.close();
      process.exit(1);
    }

    const result = await repo.summarizeWithAI(res.rid);
    if (!result) {
      console.log(chalk.gray('\n  No summary available for this resource.'));
    } else {
      console.log(chalk.bold.cyan('\n  AI Summary'));
      console.log(chalk.gray('  ───────────────────────────────'));
      console.log('');
      console.log(result.text);
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`AI 摘要失败: ${error.message}`);
    process.exit(1);
  }
}

async function knowledgeAIAskHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const query = argv.query || argv._.slice(1).join(' ') || 'overview';
    const result = await repo.askKnowledge(query);

    console.log(chalk.bold.cyan('\n  AI Knowledge Assistant'));
    console.log(chalk.gray(`  Q: ${query}`));
    console.log(chalk.gray('  ───────────────────────────────'));
    console.log('');
    console.log(result.text);

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`AI 问答失败: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════ Phase 5.9: Knowledge OS Automation Handlers ═══════════

/**
 * lo automation run
 */
async function automationRunHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    console.log(chalk.bold.cyan('\n  Knowledge Automation'));
    console.log(chalk.gray('  Running full pipeline...\n'));

    const result = await repo.runAutomation();

    // Lifecycle
    if (result.lifecycle) {
      console.log(chalk.bold('  Lifecycle:'));
      console.log(`    ${chalk.green('Active:')}     ${result.lifecycle.active}`);
      console.log(`    ${chalk.yellow('Inactive:')}   ${result.lifecycle.inactive}`);
      console.log(`    ${chalk.red('Forgotten:')}   ${result.lifecycle.forgotten}`);
      console.log(`    ${chalk.gray('Archived:')}   ${result.lifecycle.archived}`);
    }

    // Repair
    if (result.repair) {
      console.log(chalk.bold('\n  Repair:'));
      console.log(`    ${chalk.red('Broken relations:')}  ${result.repair.brokenCount}`);
      console.log(`    ${chalk.yellow('Orphan resources:')}  ${result.repair.orphanCount}`);
      console.log(`    ${chalk.cyan('Duplicate candidates:')}  ${result.repair.duplicateCount}`);
    }

    // Suggestions
    if (result.suggestions.length > 0) {
      console.log(chalk.bold(`\n  Generated ${chalk.yellow(result.suggestions.length)} suggestions:`));
      const priorities = { high: 0, medium: 0, low: 0 };
      const categories = {};
      for (const s of result.suggestions) {
        priorities[s.priority || 'medium'] = (priorities[s.priority || 'medium'] || 0) + 1;
        categories[s.sourceCategory || 'unknown'] = (categories[s.sourceCategory || 'unknown'] || 0) + 1;
      }
      console.log(`    ${chalk.red('high:')} ${priorities.high}  ${chalk.yellow('medium:')} ${priorities.medium}  ${chalk.gray('low:')} ${priorities.low}`);
      console.log(`    categories: ${Object.entries(categories).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      console.log(chalk.gray('\n    Use "lo suggestion list" to review.'));
    } else {
      console.log(chalk.green('\n  No issues found. Knowledge base is healthy.'));
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`自动化运行失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo knowledge lifecycle
 */
async function knowledgeLifecycleHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const { summary, resources } = await repo.getKnowledgeLifecycle();

    console.log(chalk.bold.cyan('\n  Knowledge Lifecycle'));
    console.log(chalk.gray('  ───────────────────────────────\n'));
    console.log(`  ${chalk.green('Active:')}     ${summary.active}`);
    console.log(`  ${chalk.yellow('Inactive:')}   ${summary.inactive}`);
    console.log(`  ${chalk.red('Forgotten:')}   ${summary.forgotten}`);
    console.log(`  ${chalk.gray('Archived:')}   ${summary.archived}`);
    console.log(`  ${chalk.gray('Total:')}      ${summary.total}`);

    // 显示被遗忘的资源
    const forgotten = resources.filter(r => r.state === 'forgotten');
    if (forgotten.length > 0) {
      console.log(chalk.red(`\n  ${forgotten.length} forgotten resource(s):`));
      for (const f of forgotten) {
        console.log(`    ${chalk.cyan(f.rid)}  ${chalk.gray(f.name)}`);
        console.log(`    ${chalk.gray(f.reason)}`);
      }
    }

    // 显示不活跃资源
    const inactive = resources.filter(r => r.state === 'inactive');
    if (inactive.length > 0) {
      console.log(chalk.yellow(`\n  ${inactive.length} inactive resource(s):`));
      for (const r of inactive.slice(0, 10)) {
        console.log(`    ${chalk.cyan(r.rid)}  ${chalk.gray(r.name)}`);
      }
      if (inactive.length > 10) {
        console.log(chalk.gray(`    ... and ${inactive.length - 10} more`));
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`生命周期查询失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo knowledge repair
 */
async function knowledgeRepairHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const diagnosis = await repo.runKnowledgeRepair();

    console.log(chalk.bold.cyan('\n  Knowledge Repair Diagnosis'));
    console.log(chalk.gray('  ───────────────────────────────'));

    // Broken relations
    if (diagnosis.brokenRelations.length > 0) {
      console.log(chalk.red(`\n  Broken relations: ${diagnosis.brokenRelations.length}`));
      for (const br of diagnosis.brokenRelations.slice(0, 10)) {
        console.log(`    #${br.id}  ${chalk.cyan(br.from_rid)} ${chalk.gray('→')} ${chalk.cyan(br.to_rid)}`);
        console.log(`    ${chalk.gray(br.suggestion.reason)}`);
      }
      if (diagnosis.brokenRelations.length > 10) {
        console.log(chalk.gray(`    ... and ${diagnosis.brokenRelations.length - 10} more`));
      }
    } else {
      console.log(chalk.green('\n  No broken relations.'));
    }

    // Orphan resources
    if (diagnosis.orphanResources.length > 0) {
      console.log(chalk.yellow(`\n  Orphan resources: ${diagnosis.orphanResources.length}`));
      for (const or of diagnosis.orphanResources.slice(0, 10)) {
        console.log(`    ${chalk.cyan(or.rid)}  ${chalk.gray(or.name)}  (${or.type})`);
      }
      if (diagnosis.orphanResources.length > 10) {
        console.log(chalk.gray(`    ... and ${diagnosis.orphanResources.length - 10} more`));
      }
    } else {
      console.log(chalk.green('\n  No orphan resources.'));
    }

    // Duplicate candidates
    if (diagnosis.duplicateCandidates.length > 0) {
      console.log(chalk.cyan(`\n  Duplicate candidates: ${diagnosis.duplicateCandidates.length}`));
      for (const dc of diagnosis.duplicateCandidates.slice(0, 10)) {
        console.log(`    ${chalk.cyan(dc.resourceA.name)} ${chalk.gray('≈')} ${chalk.cyan(dc.resourceB.name)}  ${chalk.gray((dc.similarity * 100).toFixed(0) + '%')}`);
      }
      if (diagnosis.duplicateCandidates.length > 10) {
        console.log(chalk.gray(`    ... and ${diagnosis.duplicateCandidates.length - 10} more`));
      }
    } else {
      console.log(chalk.green('\n  No duplicate candidates.'));
    }

    if (diagnosis.summary.totalIssues === 0) {
      console.log(chalk.green('\n  Knowledge base is clean.'));
    } else {
      console.log(chalk.yellow(`\n  Total issues: ${diagnosis.summary.totalIssues}`));
      console.log(chalk.gray('  Run "lo automation run" to generate fix suggestions.'));
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`修复诊断失败: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════ Phase 5.10: Distributed Knowledge Graph Handlers ═══════════

/**
 * lo federation list
 */
async function federationListHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const repos = await repo.listFederatedRepositories();

    console.log(chalk.bold.cyan('\n  Federated Repositories'));
    console.log(chalk.gray('  ───────────────────────────────\n'));

    if (repos.length === 0) {
      console.log(chalk.gray('  No federated repositories registered.'));
      console.log(chalk.gray('  Use "lo federation add <path> --namespace <ns>" to register.'));
    } else {
      for (const r of repos) {
        console.log(`  ${chalk.cyan(r.namespace)}  ${chalk.green(r.name)}`);
        console.log(`    ${chalk.gray(r.path)}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`联邦列表失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo federation add <path> --namespace <ns>
 */
async function federationAddHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const result = await repo.registerFederatedRepository(
      argv.name || path.basename(argv.path),
      argv.namespace,
      argv.path
    );

    console.log(chalk.green(`\n  Registered: ${result.namespace} → ${result.path}\n`));
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`联邦注册失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo federation remove <namespace>
 */
async function federationRemoveHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const result = await repo.removeFederatedRepository(argv.namespace);

    console.log(chalk.green(`\n  Removed: ${result.removed}\n`));
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`联邦移除失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo sync pull <namespace>
 */
async function syncPullHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    console.log(chalk.bold.cyan(`\n  Pulling from ${argv.namespace}...\n`));

    const result = await repo.syncPull(argv.namespace);

    console.log(`  Imported:     ${chalk.green(result.status.imported)}`);
    if (result.status.conflicts > 0) {
      console.log(`  Conflicts:    ${chalk.red(result.status.conflicts)}`);
    }
    console.log('');

    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`同步失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo sync push <namespace>
 */
async function syncPushHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    console.log(chalk.bold.cyan(`\n  Pushing to ${argv.namespace}...\n`));

    const result = await repo.syncPush(argv.namespace);

    console.log(`  Pushed:  ${chalk.green(result.pushed)} resources`);
    console.log('');

    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`同步失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo sync status
 */
async function syncStatusHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const status = await repo.getSyncStatus();

    console.log(chalk.bold.cyan('\n  Sync Status'));
    console.log(chalk.gray('  ───────────────────────────────'));
    console.log(`  Resources:       ${chalk.green(status.resources)}`);
    console.log(`  Remote:          ${chalk.cyan(status.remoteResources)}`);
    console.log(`  Relations:       ${status.relations}`);
    console.log(`  Conflicts:       ${status.conflicts > 0 ? chalk.red(status.conflicts) : chalk.green(0)}`);

    if (status.lastSync) {
      console.log(`  Last Sync:       ${chalk.gray(status.lastSync.type)} (${new Date(status.lastSync.created).toLocaleString()})`);
    } else {
      console.log(chalk.gray('\n  No sync history.'));
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`同步状态查询失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo sync conflict list
 */
async function syncConflictListHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const conflicts = await repo.listConflicts({ status: 'pending' });

    console.log(chalk.bold.cyan('\n  Pending Conflicts'));
    console.log(chalk.gray('  ───────────────────────────────\n'));

    if (conflicts.length === 0) {
      console.log(chalk.green('  No pending conflicts.'));
    } else {
      for (const c of conflicts) {
        console.log(`  ${chalk.yellow(c.id)}  ${c.resource}`);
        console.log(`    ${chalk.gray('type:')} ${c.type}`);
      }
      console.log(chalk.gray(`\n  Use "lo sync conflict resolve <id> <local-win|remote-win>"`));
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`冲突列表查询失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo sync conflict resolve <id> <strategy>
 */
async function syncConflictResolveHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const result = await repo.resolveConflict(argv.id, argv.strategy);

    console.log(chalk.green(`\n  Resolved: ${argv.id} (${argv.strategy})\n`));
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`冲突解决失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo graph query-federated <globalId>
 */
async function graphQueryFederatedHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const depth = argv.depth || 3;
    const result = await repo.queryFederatedGraph(argv.globalId, { depth });

    console.log(chalk.bold.cyan(`\n  Federated Query: ${argv.globalId} (depth ${depth})`));
    console.log(chalk.gray('  ───────────────────────────────'));

    console.log(`  Nodes: ${result.nodes.length}`);
    console.log(`  Edges: ${result.edges.length}`);

    if (result.nodes.length > 0) {
      console.log(chalk.bold('\n  Nodes:'));
      for (const n of result.nodes.slice(0, 20)) {
        console.log(`    ${chalk.cyan(n.id)}  [${chalk.gray(n.source || '?')}]`);
      }
      if (result.nodes.length > 20) {
        console.log(chalk.gray(`    ... and ${result.nodes.length - 20} more`));
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`联邦查询失败: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════ Phase 5.11: Knowledge Evolution Handlers ═══════════

/**
 * lo knowledge evolution
 */
async function knowledgeEvolutionHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const result = await repo.analyzeEvolution({ period: 30 });

    console.log(chalk.bold.cyan('\n  Knowledge Evolution'));
    console.log(chalk.gray('  ───────────────────────────────'));

    // Growth
    if (result.growth) {
      console.log(chalk.bold('\n  Growth (30d):'));
      console.log(`    Resources: +${chalk.green(result.growth.newResources)}`);
      console.log(`    Relations: +${chalk.green(result.growth.newRelations)}`);
      console.log(`    Rate:       ${chalk.cyan(result.growth.rate)} / day`);
    }

    // Velocity
    if (result.velocity) {
      console.log(chalk.bold('\n  Velocity:'));
      console.log(`    Value: ${chalk.cyan(result.velocity.value)}`);
      console.log(`    Type:  ${result.velocity.type === 'connector' ? chalk.green('connector') : result.velocity.type === 'balanced' ? chalk.cyan('balanced') : chalk.yellow('collector')}`);
    }

    // Entropy
    if (result.entropy) {
      console.log(chalk.bold('\n  Entropy:'));
      console.log(`    Value:  ${chalk.cyan(result.entropy.normalized)}`);
      console.log(`    Status: ${result.entropy.interpretation === 'balanced' ? chalk.green('balanced') : result.entropy.interpretation === 'concentrated' ? chalk.yellow('concentrated') : chalk.cyan('moderate')}`);
      console.log(`    Types:  ${result.entropy.typeCount}`);
    }

    // Trend
    if (result.trend) {
      console.log(chalk.bold('\n  Trend:'));
      const dirLabel = result.trend.direction === 'accelerating' ? chalk.green('accelerating') :
        result.trend.direction === 'decelerating' ? chalk.red('decelerating') : chalk.gray('stable');
      console.log(`    Direction: ${dirLabel}`);
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`演化分析失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo knowledge patterns
 */
async function knowledgePatternsHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const patterns = await repo.detectKnowledgePatterns({ minDegree: 3, maxResults: 15 });

    console.log(chalk.bold.cyan('\n  Detected Knowledge Patterns'));
    console.log(chalk.gray('  ───────────────────────────────'));

    // Hubs
    if (patterns.hubs && patterns.hubs.length > 0) {
      console.log(chalk.bold('\n  Hubs:'));
      for (const h of patterns.hubs) {
        console.log(`    ${chalk.cyan(h.rid)}  degree: ${chalk.green(h.degree)} (in:${h.incoming} out:${h.outgoing})`);
      }
    } else {
      console.log(chalk.gray('\n  No hub patterns found.'));
    }

    // Chains
    if (patterns.chains && patterns.chains.length > 0) {
      console.log(chalk.bold('\n  Chains:'));
      for (const c of patterns.chains) {
        console.log(`    ${chalk.cyan(`[${c.length}]`)}  ${c.description}`);
      }
    }

    // Bridges
    if (patterns.bridges && patterns.bridges.length > 0) {
      console.log(chalk.bold('\n  Bridges:'));
      for (const b of patterns.bridges) {
        console.log(`    ${chalk.cyan(b.rid)}  ${chalk.gray(b.description)}`);
      }
    }

    // Dead-ends
    if (patterns.deadEnds && patterns.deadEnds.length > 0) {
      console.log(chalk.bold('\n  Dead Ends:'));
      for (const d of patterns.deadEnds) {
        console.log(`    ${chalk.cyan(d.rid)}  ${chalk.yellow(`${d.incoming} refs`)} → no outgoing`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`模式检测失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo knowledge strategy
 */
async function knowledgeStrategyHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const actions = await repo.generateKnowledgeStrategy();

    console.log(chalk.bold.cyan('\n  Recommended Knowledge Actions'));
    console.log(chalk.gray('  ───────────────────────────────'));

    if (actions.length === 0) {
      console.log(chalk.green('\n  Knowledge base is well-balanced. No actions recommended.'));
    }

    for (const a of actions) {
      const actionColor = {
        connect: chalk.green,
        expand: chalk.cyan,
        refactor: chalk.yellow,
        explore: chalk.magenta
      }[a.action] || chalk.white;

      const priorityIcon = a.priority === 'high' ? '!' : a.priority === 'medium' ? '~' : '.';

      console.log(actionColor(`\n  [${a.action.toUpperCase()}] ${priorityIcon}`));
      console.log(`    ${chalk.gray(a.reason)}`);
      if (a.suggestion) {
        console.log(`    ${chalk.gray('→ ' + a.suggestion)}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`策略生成失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo knowledge snapshot
 */
async function knowledgeSnapshotHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const snap = await repo.createKnowledgeSnapshot();

    console.log(chalk.green(`\n  Snapshot created:`));
    console.log(`    ID:       ${chalk.cyan(snap.id)}`);
    console.log(`    Date:     ${new Date(snap.created_at).toLocaleDateString()}`);
    console.log(`    Resources: ${snap.resourceCount}`);
    console.log(`    Relations: ${snap.relationCount}`);
    console.log(`    Density:   ${snap.density}`);
    console.log(`    Entropy:   ${snap.entropy}`);
    console.log(`    Growth:    ${snap.growth}`);

    console.log(chalk.gray('\n  Use "lo knowledge snapshot list" to view history.\n'));
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`快照创建失败: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════ Phase 6.1: Plugin System Handlers ═══════════

/**
 * lo plugin list
 */
async function pluginListHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    await repo.initPluginSystem();
    const plugins = await repo.listPlugins();

    console.log(chalk.bold.cyan('\n  Plugins'));
    console.log(chalk.gray('  ───────────────────────────────\n'));

    if (plugins.length === 0) {
      console.log(chalk.gray('  No plugins loaded.'));
    } else {
      for (const p of plugins) {
        const stateIcon = p.state === 'enabled' ? chalk.green('enabled') :
                           p.state === 'disabled' ? chalk.yellow('disabled') : chalk.gray(p.state);
        console.log(`  ${chalk.cyan(p.id.padEnd(15))}  ${p.name}`);
        console.log(`    ${chalk.gray('v' + p.version.padEnd(10))}  ${stateIcon}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`插件列表失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo plugin enable <id>
 */
async function pluginEnableHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    await repo.enablePlugin(argv.id);

    console.log(chalk.green(`\n  Plugin '${argv.id}' enabled.\n`));
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`插件启用失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo plugin disable <id>
 */
async function pluginDisableHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    await repo.disablePlugin(argv.id);

    console.log(chalk.yellow(`\n  Plugin '${argv.id}' disabled.\n`));
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`插件禁用失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo plugin reload <id>
 */
async function pluginReloadHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    await repo.reloadPlugin(argv.id);

    console.log(chalk.green(`\n  Plugin '${argv.id}' reloaded.\n`));
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`插件重载失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo plugin info <id>
 */
async function pluginInfoHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    await repo.initPluginSystem();
    const pm = repo.getPluginManager();
    const plugin = pm.getPlugin(argv.id);

    if (!plugin) {
      console.log(chalk.red(`\n  Plugin '${argv.id}' not found.\n`));
    } else {
      const manifest = plugin.manifest();
      console.log(chalk.bold.cyan(`\n  ${plugin.name}`));
      console.log(chalk.gray('  ───────────────────────────────'));
      console.log(`  ID:       ${chalk.cyan(plugin.id)}`);
      console.log(`  Version:  ${manifest.version || '?'}`);
      console.log(`  State:    ${plugin.state === 'enabled' ? chalk.green(plugin.state) : chalk.yellow(plugin.state)}`);

      if (manifest.dependencies && manifest.dependencies.length > 0) {
        console.log(`  Deps:     ${manifest.dependencies.join(', ')}`);
      }

      if (manifest.contributes) {
        const contributes = manifest.contributes;
        const types = Object.keys(contributes).filter(k => contributes[k] && contributes[k].length > 0);
        if (types.length > 0) {
          console.log(`  Contributes:`);
          for (const t of types) {
            console.log(`    ${t}: ${Array.isArray(contributes[t]) ? contributes[t].join(', ') : contributes[t]}`);
          }
        }
      }

      // 扩展注册信息
      const extRegistry = repo.getPluginExtensionRegistry();
      for (const extType of extRegistry.types()) {
        const exts = extRegistry.list(extType).filter(e => e.pluginId === argv.id);
        if (exts.length > 0) {
          console.log(`  [${extType}]: ${exts.map(e => e.key).join(', ')}`);
        }
      }

      // Hook 信息
      const hooks = repo.getPluginHookManager();
      const hookCount = hooks.hookNames()
        .map(n => hooks.listenerCount(n))
        .reduce((a, b) => a + b, 0);
      if (hookCount > 0) {
        console.log(`  Hooks:     ${hookCount} registered`);
      }

      console.log('');
    }

    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`插件信息失败: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════ Phase 6.2: Event System Handlers ═══════════

/**
 * lo event list
 */
async function eventListHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const options = { limit: argv.limit || 20 };
    if (argv.type) options.type = argv.type;
    if (argv.source) options.source = argv.source;

    const history = await repo.getEventHistory(options);

    console.log(chalk.bold.cyan('\n  Event History'));
    console.log(chalk.gray('  ───────────────────────────────\n'));

    if (history.length === 0) {
      console.log(chalk.gray('  No events recorded yet.'));
    } else {
      for (const e of history) {
        const time = new Date(e.createdAt).toLocaleString();
        console.log(`  ${chalk.cyan(e.id.slice(0, 16))}  ${chalk.yellow(e.type.padEnd(28))}  ${chalk.gray(e.source.padEnd(12))}  ${time}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`事件列表失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo event history
 */
async function eventHistoryHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const stats = await repo.getEventStats();

    console.log(chalk.bold.cyan('\n  Event Statistics'));
    console.log(chalk.gray('  ───────────────────────────────\n'));

    if (stats.length === 0) {
      console.log(chalk.gray('  No events recorded.'));
    } else {
      for (const s of stats) {
        console.log(`  ${chalk.yellow(s.type.padEnd(30))}  ${chalk.cyan(String(s.count).padStart(5))}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`事件统计失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo event listeners <type>
 */
async function eventListenersHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const type = argv.type || null;

    if (!type) {
      const types = repo.getRegisteredEventTypes();
      console.log(chalk.bold.cyan('\n  Registered Event Types'));
      console.log(chalk.gray('  ───────────────────────────────\n'));
      if (types.length === 0) {
        console.log(chalk.gray('  No listeners registered.'));
      } else {
        for (const t of types) {
          const count = repo.getEventListeners(t);
          console.log(`  ${chalk.yellow(t.padEnd(30))}  ${chalk.cyan(String(count).padStart(3))} listeners`);
        }
      }
    } else {
      const count = repo.getEventListeners(type);
      console.log(chalk.bold.cyan(`\n  Listeners for '${type}'`));
      console.log(`  ${chalk.cyan(count)} listener(s) registered.`);
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`事件监听器查询失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo event replay <id>
 */
async function eventReplayHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    let events;

    if (argv.id) {
      // Replay from specific event
      const store = new (require('../event/eventStore.cjs'))(repo.db);
      const event = await store.get(argv.id);
      if (!event) {
        console.log(chalk.red(`\n  Event '${argv.id}' not found.\n`));
        await repo.close();
        process.exit(1);
      }

      events = await repo.replayEvents({
        since: event.createdAt,
        limit: argv.limit || 50
      });
    } else {
      // Replay all
      events = await repo.replayEvents({ limit: argv.limit || 20 });
    }

    console.log(chalk.bold.cyan('\n  Event Replay'));
    console.log(chalk.gray('  ───────────────────────────────\n'));

    if (events.length === 0) {
      console.log(chalk.gray('  No events to replay.'));
    } else {
      for (const e of events) {
        const time = new Date(e.createdAt).toLocaleString();
        console.log(`  ${chalk.green('▶')} ${chalk.yellow(e.type.padEnd(28))}  ${chalk.gray(time)}`);
      }
    }

    console.log(`\n  ${chalk.cyan(events.length)} events replayed.\n`);
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`事件回放失败: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════ Phase 6.3: Workflow Handlers ═══════════

/**
 * lo workflow list
 */
async function workflowListHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });
    await repo.initWorkflowSystem();

    const workflows = await repo.listWorkflows();

    console.log(chalk.bold.cyan('\n  Workflows'));
    console.log(chalk.gray('  ───────────────────────────────\n'));

    if (workflows.length === 0) {
      console.log(chalk.gray('  No workflows registered.'));
    } else {
      for (const wf of workflows) {
        const statusIcon = wf.status === 'active' ? chalk.green('active') : chalk.gray(wf.status);
        console.log(`  ${chalk.cyan(wf.id.padEnd(28))}  ${chalk.yellow(wf.name.padEnd(16))}  ${chalk.gray(String(wf.stepCount).padStart(3))} steps  ${statusIcon}`);
        if (wf.description) {
          console.log(`    ${chalk.gray(wf.description)}`);
        }
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`工作流列表失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo workflow run <id>
 */
async function workflowRunHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });
    await repo.initWorkflowSystem();

    const result = await repo.executeWorkflow(argv.id, argv.input ? JSON.parse(argv.input) : {});

    console.log(chalk.bold.cyan('\n  Workflow Result'));
    console.log(chalk.gray('  ───────────────────────────────\n'));
    console.log(`  ${chalk.cyan('Execution ID:')}  ${result.executionId}`);
    console.log(`  ${chalk.cyan('Status:')}       ${result.status === 'completed' ? chalk.green(result.status) : chalk.red(result.status)}`);
    console.log(`  ${chalk.cyan('Steps:')}        ${Object.keys(result.results).length}`);
    console.log('');

    for (const [stepId, stepResult] of Object.entries(result.results)) {
      const icon = stepResult.success !== false ? chalk.green('✓') : chalk.red('✗');
      console.log(`    ${icon} ${chalk.yellow(stepId)}`);
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`工作流执行失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo workflow status <executionId>
 */
async function workflowStatusHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });
    await repo.initWorkflowSystem();

    const status = await repo.getWorkflowStatus(argv.id);

    if (!status) {
      console.log(chalk.yellow(`\n  Execution '${argv.id}' not found.\n`));
    } else {
      console.log(chalk.bold.cyan('\n  Workflow Execution'));
      console.log(chalk.gray('  ───────────────────────────────\n'));
      console.log(`  ${chalk.cyan('ID:')}        ${status.id}`);
      console.log(`  ${chalk.cyan('Workflow:')}  ${status.workflowId}`);
      console.log(`  ${chalk.cyan('Status:')}    ${status.status === 'completed' ? chalk.green(status.status) : status.status === 'failed' ? chalk.red(status.status) : chalk.yellow(status.status)}`);
      console.log(`  ${chalk.cyan('Created:')}   ${new Date(status.createdAt).toLocaleString()}`);

      if (status.context && status.context.results) {
        console.log(`\n  ${chalk.cyan('Steps:')}`);
        for (const [stepId, result] of Object.entries(status.context.results)) {
          const icon = result.success !== false ? chalk.green('✓') : chalk.red('✗');
          console.log(`    ${icon} ${chalk.yellow(stepId)}`);
        }
      }

      console.log('');
    }

    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`工作流状态查询失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo workflow history [workflowId]
 */
async function workflowHistoryHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });
    await repo.initWorkflowSystem();

    const history = await repo.getWorkflowHistory(argv.id || null, argv.limit || 20);

    console.log(chalk.bold.cyan('\n  Workflow History'));
    console.log(chalk.gray('  ───────────────────────────────\n'));

    if (history.length === 0) {
      console.log(chalk.gray('  No executions recorded.'));
    } else {
      for (const h of history) {
        const statusIcon = h.status === 'completed' ? chalk.green('✓') :
                           h.status === 'failed' ? chalk.red('✗') : chalk.yellow('○');
        const time = new Date(h.createdAt).toLocaleString();
        console.log(`  ${statusIcon} ${chalk.cyan(h.id.slice(0, 20).padEnd(22))} ${chalk.yellow(h.workflowId.padEnd(24))} ${chalk.gray(time)}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`工作流历史查询失败: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════ Phase 6.4: Permission Handlers ═══════════

/**
 * lo permission role list
 */
async function permissionRoleListHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });
    await repo.initPermissionSystem();

    const roles = await repo.listRoles();

    console.log(chalk.bold.cyan('\n  Roles'));
    console.log(chalk.gray('  ───────────────────────────────\n'));

    for (const r of roles) {
      console.log(`  ${chalk.cyan(r.id.padEnd(15))}  ${r.name.padEnd(10)}  ${chalk.gray(String(r.permissionCount).padStart(3))} permissions  ${chalk.gray(r.description)}`);
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`角色列表失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo permission check <subject> <action> [resource]
 */
async function permissionCheckHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });
    await repo.initPermissionSystem();

    const result = await repo.checkPermission(argv.subject, argv.action, argv.resource || null);

    console.log(chalk.bold.cyan('\n  Permission Check'));
    console.log(chalk.gray('  ───────────────────────────────\n'));
    console.log(`  ${chalk.cyan('Subject:')}   ${argv.subject}`);
    console.log(`  ${chalk.cyan('Action:')}    ${argv.action}`);
    if (argv.resource) console.log(`  ${chalk.cyan('Resource:')}  ${argv.resource}`);
    console.log(`  ${chalk.cyan('Result:')}    ${result.allowed ? chalk.green('ALLOWED') : chalk.red('DENIED')}`);
    console.log(`  ${chalk.cyan('Reason:')}    ${result.reason}`);
    console.log('');

    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`权限检查失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo permission audit
 */
async function permissionAuditHandler() {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });

    const auditLog = await repo.getPermissionAudit({ limit: 20 });
    const deniedStats = await repo.getDeniedPermissionStats();

    console.log(chalk.bold.cyan('\n  Permission Audit'));
    console.log(chalk.gray('  ───────────────────────────────\n'));

    if (deniedStats.length > 0) {
      console.log(chalk.yellow('  Denied:'));
      for (const d of deniedStats.slice(0, 5)) {
        console.log(`    ${chalk.red(d.subject.padEnd(15))} ${d.action.padEnd(20)} x${d.count}`);
      }
      console.log('');
    }

    console.log(chalk.cyan('  Recent:'));
    if (auditLog.length === 0) {
      console.log(chalk.gray('    No audit records yet.'));
    } else {
      for (const a of auditLog.slice(0, 10)) {
        const icon = a.allowed ? chalk.green('✓') : chalk.red('✗');
        const time = new Date(a.createdAt).toLocaleString();
        console.log(`    ${icon} ${a.subject.padEnd(12)} ${a.action.padEnd(20)} ${chalk.gray(time)}`);
      }
    }

    console.log('');
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`权限审计失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * lo permission grant <subject> <action>
 */
async function permissionGrantHandler(argv) {
  try {
    const repo = new Repository(process.cwd());
    await repo.open({ skipAuth: true });
    await repo.initPermissionSystem();

    await repo.grantPermission(argv.subject, argv.action);

    console.log(chalk.green(`\n  Granted '${argv.action}' to '${argv.subject}'.\n`));
    await repo.close();
    process.exit(0);
  } catch (error) {
    Logger.error(`权限授予失败: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  neighbors: neighborsHandler,
  backlinks: backlinksHandler,
  path: pathHandler,
  cycles: cyclesHandler,
  export: exportHandler,
  analyze: analyzeHandler,
  query: queryHandler,
  neighborhood: neighborhoodHandler,
  explain: explainHandler,
  related: relatedHandler,
  resourceBacklinks: resourceBacklinksHandler,
  impact: impactHandler,
  knowledgeAnalyze: knowledgeAnalyzeHandler,
  knowledgeGaps: knowledgeGapsHandler,
  knowledgeRecommend: knowledgeRecommendHandler,
  knowledgeTimeline: knowledgeTimelineHandler,
  suggestionList: suggestionListHandler,
  suggestionApprove: suggestionApproveHandler,
  suggestionExecute: suggestionExecuteHandler,
  suggestionReject: suggestionRejectHandler,
  knowledgeAIExplain: knowledgeAIExplainHandler,
  knowledgeAISummarize: knowledgeAISummarizeHandler,
  knowledgeAIAsk: knowledgeAIAskHandler,
  automationRun: automationRunHandler,
  knowledgeLifecycle: knowledgeLifecycleHandler,
  knowledgeRepairDiagnosis: knowledgeRepairHandler,
  federationList: federationListHandler,
  federationAdd: federationAddHandler,
  federationRemove: federationRemoveHandler,
  syncPull: syncPullHandler,
  syncPush: syncPushHandler,
  syncStatus: syncStatusHandler,
  syncConflictList: syncConflictListHandler,
  syncConflictResolve: syncConflictResolveHandler,
  graphQueryFederated: graphQueryFederatedHandler,
  knowledgeEvolution: knowledgeEvolutionHandler,
  knowledgePatterns: knowledgePatternsHandler,
  knowledgeStrategy: knowledgeStrategyHandler,
  knowledgeSnapshot: knowledgeSnapshotHandler,
  pluginList: pluginListHandler,
  pluginEnable: pluginEnableHandler,
  pluginDisable: pluginDisableHandler,
  pluginReload: pluginReloadHandler,
  pluginInfo: pluginInfoHandler,
  eventList: eventListHandler,
  eventHistory: eventHistoryHandler,
  eventListeners: eventListenersHandler,
  eventReplay: eventReplayHandler,
  workflowList: workflowListHandler,
  workflowRun: workflowRunHandler,
  workflowStatus: workflowStatusHandler,
  workflowHistory: workflowHistoryHandler,
  permissionRoleList: permissionRoleListHandler,
  permissionCheck: permissionCheckHandler,
  permissionAudit: permissionAuditHandler,
  permissionGrant: permissionGrantHandler
};
