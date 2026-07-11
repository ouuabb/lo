/**
 * relation.update — 更新资源关系
 *
 * Phase 5.2: Relation Operation Handler
 */
module.exports = {
  type: 'relation.update',

  execute(ctx, params) {
    const { id, updates } = params;
    return ctx.relationService.update(id, updates);
  },

  undo(ctx, params) {
    const { operation } = params;
    const before = operation.before || {};
    // 恢复为修改前的状态
    return ctx.relationService.update(before.id, {
      type: before.oldType,
      metadata: before.oldMetadata
    });
  }
};
