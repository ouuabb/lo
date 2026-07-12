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
  graphQueryFederated: graphQueryFederatedHandler
};
