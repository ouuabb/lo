/**
 * SharedMemory — 共享记忆
 *
 * Phase 6.6: 所有 Agent 可访问的共享存储。
 *
 * 存储类型:
 *   knowledge    — 知识
 *   decision     — 决策
 *   conversation — 对话
 *   result       — 结果
 *
 * 作用域: team | team.task | global
 */

class SharedMemory {
  constructor() {
    /** @type {Map<string, Array>} */
    this._store = new Map();
  }

  /**
   * 写入共享记忆
   * @param {{ scope: string, type: string, content: any, owner?: string, visibility?: string }} entry
   */
  write({ scope, type, content, owner, visibility }) {
    const id = `sm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const entry = {
      id,
      scope: scope || 'team',
      type: type || 'knowledge',
      content,
      owner: owner || 'system',
      visibility: visibility || 'all',
      createdAt: Date.now()
    };

    const key = `${scope}:${type}`;
    if (!this._store.has(key)) {
      this._store.set(key, []);
    }
    this._store.get(key).push(entry);

    return entry;
  }

  /**
   * 查询共享记忆
   */
  read({ scope, type, limit = 20 }) {
    const results = [];

    for (const [key, entries] of this._store) {
      // scope:type 匹配或 scope:* 匹配
      const matches = (!scope || key.startsWith(scope + ':')) &&
                      (!type || key.endsWith(':' + type));

      if (matches) {
        results.push(...entries.slice(-limit));
      }
    }

    // 按时间倒序
    results.sort((a, b) => b.createdAt - a.createdAt);
    return results.slice(0, limit);
  }

  /**
   * 清空
   */
  clear(scope) {
    if (scope) {
      for (const key of this._store.keys()) {
        if (key.startsWith(scope + ':')) {
          this._store.delete(key);
        }
      }
    } else {
      this._store.clear();
    }
  }

  /**
   * 统计
   */
  stats() {
    let count = 0;
    for (const entries of this._store.values()) {
      count += entries.length;
    }
    return { entryCount: count, scopeCount: this._store.size };
  }
}

module.exports = SharedMemory;
