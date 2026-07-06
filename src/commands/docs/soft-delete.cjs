const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  软删除与关联数据残留'));

    // 概念
    console.log(chalk.bold.yellow('\n  什么是软删除'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  lo 中删除资源采用软删除策略：资源行在数据库中标记 deleted = 1，
  而非从 resources 表中物理移除。这意味着：

    - 资源数据本身仍保留在数据库中
    - 所有查询 API 中 WHERE deleted = 0 会将其过滤掉
    - 用户层面表现为"已删除"、不可见

  设计意图：保留数据以供未来可能的恢复、审计或同步冲突处理。
  类比 Git 中的 git rm 并非真正从历史中抹除文件。`);

    // 核心行为
    console.log(chalk.bold.yellow('\n  软删除时 relations 不清除'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  当某一资源（称其为 B）被软删除时，relations 表中所有包含 B 的
  记录（无论 B 是 from_rid 还是 to_rid）不会被自动清除。

  举例：

    删除前:
      A ---[wikilink]--→ B
      relations: { from_rid: A, to_rid: B, type: 'wikilink' }

    执行 lo rm + lo commit 后:
      resources:  B.deleted = 1
      relations:  { from_rid: A, to_rid: B, type: 'wikilink' }  ← 保留

  这是有意为之的设计决定，而非 bug。以下详细说明各种场景下的行为。`);

    // 各 API 查询行为差异
    console.log(chalk.bold.yellow('\n  各 API 的行为差异'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  ┌─────────────────────────┬──────────────────────────────────┐
  │  API                    │  对已删除资源的 relation 行为     │
  ├─────────────────────────┼──────────────────────────────────┤
  │  resourceService.*      │  不返回。所有查询带               │
  │  (getByRid/getByPath/   │  WHERE deleted = 0 过滤          │
  │   getAll/importFile)    │                                  │
  │                         │                                  │
  │  relationService.       │  正常返回。不做任何过滤，         │
  │  getRelations(rid)      │  孤儿 relation 仍可见             │
  │                         │                                  │
  │  relationService.       │  正常返回。只按 from_rid/to_rid   │
  │  getByFromRid(rid)      │  过滤，不关心目标是否存在          │
  │  getByToRid(rid)        │                                  │
  │                         │                                  │
  │  relationService.       │  返回全部，包括孤儿记录            │
  │  getAll()               │                                  │
  │                         │                                  │
  │  queryEngine.           │  不可见。JOIN 时有                 │
  │  getGraph(rid)          │  AND r.deleted = 0 过滤          │
  │                         │                                  │
  │  queryEngine.           │  计入总数。直接 COUNT(*)          │
  │  getStats()             │  relations 表，无过滤              │
  │  (totalRelations)       │                                  │
  │                         │                                  │
  │  queryEngine.           │  可能受影响。已删资源的            │
  │  queryUnreferenced()    │  relation 会干扰"无引用"判断       │
  └─────────────────────────┴──────────────────────────────────┘

  关键差异总结：
    - relationService（底层 API） → 不做资源有效性判断，直接查 relations 表
    - queryEngine.getGraph（高层 API） → 通过 JOIN 过滤已删资源
    - 两者对同一问题的返回结果不一致`);

    // getGraph vs getRelations 的矛盾
    console.log(chalk.bold.yellow('\n  getGraph 与 getRelations 的矛盾'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  场景：A 通过 wikilink 链接到 B，之后 B 被软删除。

    getGraph(A):
      查询: SELECT ... FROM relations rel
            JOIN resources r ON rel.to_rid = r.rid
            WHERE rel.from_rid = A AND r.deleted = 0
      结果: 不返回 A→B 的边（B 被 JOIN 条件过滤掉）
      用户感知: A 看起来从未关联过 B

    getRelations(A) (通过 relationService):
      查询: SELECT * FROM relations WHERE from_rid = A
      结果: 返回 A→B 的记录
      但用 B 的 rid 再查资源详情: 返回 null

  对于可视化场景的影响：

    ┌────────────────────────────┬───────────────────────────────────┐
    │  可视化的数据源            │  用户看到的                        │
    ├────────────────────────────┼───────────────────────────────────┤
    │  使用 getGraph()           │  连线静默消失，图看起来是干净的    │
    │                            │  但实际 relation 数据仍残留        │
    │                            │                                   │
    │  使用 relationService      │  连线存在但目标节点找不到          │
    │  然后查资源详情             │  → 出现"断头边"或空引用           │
    │                            │  → 展示层需要额外处理 null 情况    │
    └────────────────────────────┴───────────────────────────────────┘

  建议：可视化层应意识到这种不一致性，根据数据源做好防御处理。`);

    // unlink 无法解绑
    console.log(chalk.bold.yellow('\n  lo unlink 无法解除孤儿链接'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  lo unlink 命令在执行前会验证双方资源是否存在：

    resourceB = await repo.getResource(to);   // 走 resourceService，过滤 deleted=0
    if (!resourceB) {
        Logger.error('目标资源不存在');        // 直接退出
        process.exit(1);
    }

  后果：如果 B 已被软删除，lo unlink A B 会因 B 不存在而失败。
  用户无法通过 CLI 命令手动清理 A→B 的孤儿 relation 记录。

  这是软删除策略的必然结果：既然 B 对外"已删除"，unlink 就找不到它。`);

    // sync 跨设备传播
    console.log(chalk.bold.yellow('\n  跨设备同步中的行为'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  RESOURCE_DELETED 操作记录在 sync_ops 中，同步到其他设备后：

    重放 RESOURCE_DELETED 操作：
      → 仅更新 resources 表 deleted = 1
      → 不包含 relations 清理指令

    结果：孤儿 relation 数据会随同步传播到所有设备。

  这意味着在多设备场景下，每台设备的 relations 表都可能累积
  指向已删除资源的记录。这是当前设计的行为特征，需知晓。`);

    // stats 计数影响
    console.log(chalk.bold.yellow('\n  对 getStats 统计的影响'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  getStats().totalRelations 直接 COUNT(*) FROM relations，
  不做任何过滤。孤儿 relation 会计入总数。

    结果：统计数字可能大于"有效链接数"。
    如需"有效关系数"，需自行 JOIN resources 表过滤。`);

    // 设计理由
    console.log(chalk.bold.yellow('\n  设计理由'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
  软删除不级联清除 relations 是刻意为之，基于以下几点：

    1. 数据可恢复性
       软删除保留了恢复资源的可能性。如果级联删除了 relations，
       恢复时需重建所有关联关系，丢失的信息无法找回。

    2. 审计追溯
       保留 relations 记录意味着可以追溯历史链接关系，
       即使目标资源已不可见。

    3. 同步冲突处理
       在跨设备同步场景中，若一台设备删除了某资源而另一台恰有
       编辑冲突，保留 relations 为冲突处理保留了上下文。

    4. 关注点分离
       relationService 是底层数据访问层，不应承担业务校验职责。
       是否过滤已删除资源由上层（queryEngine / 应用层）决定。

  这一设计取舍的结果是：上层 API（getGraph）能正确处理，
  底层 API（relationService）返回原始数据。调用方需根据
  使用场景选择合适的 API 层。`);

    // 相关命令
    console.log(chalk.bold.yellow('\n  相关文档'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    console.log(`
    lo docs database      数据库表结构与索引
    lo docs wikilink      [[wikilink]] 双向链接系统
    lo docs version       版本控制与暂存区
    lo docs sync          远程同步系统`);
};
