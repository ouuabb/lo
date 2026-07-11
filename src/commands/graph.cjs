/**
 * lo graph — Resource Relation Graph CLI
 * Phase 5.3
 */

const chalk = require('chalk');
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
  knowledgeTimeline: knowledgeTimelineHandler
};
