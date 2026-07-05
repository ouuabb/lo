/**
 * 资源元数据严格校验模块
 *
 * 所有 resource metadata 写入 SQLite 前必须通过此校验，不通过直接报错。
 * 两个入口点：
 *   1. resourceService.create / update → 本地写入前
 *   2. syncOps._applyOp → 远程 ops 重放写入前
 *
 * 策略：
 *   - 已知字段：严格类型校验，不通过则 throw
 *   - 已知字段值域：白名单校验（如 status）
 *   - 未知字段：直接报错，不允许存在
 *   - category 空字符串自动规范化为 null
 *   - tags 重复值自动去重
 */

/**
 * 合法的 status 值
 */
const VALID_STATUSES = new Set(['draft', 'published', 'archived']);

/**
 * 已知的 metadata 字段规范
 * 每个字段定义：{ type: string, validator?: Function, normalize?: Function }
 */
const FIELD_SCHEMA = {
  title: {
    type: 'string',
    check(v) { return typeof v === 'string' && v.length > 0; }
  },
  wordCount: {
    type: 'number',
    check(v) { return typeof v === 'number' && Number.isInteger(v) && v >= 0; }
  },
  tags: {
    type: 'array',
    check(v) {
      if (!Array.isArray(v)) return false;
      return v.every(t => typeof t === 'string' && t.length > 0);
    }
  },
  category: {
    type: 'string|null',
    check(v) { return v === null || typeof v === 'string'; },
    normalize(v) { return (v === '' || v === undefined) ? null : v; }
  },
  status: {
    type: 'string',
    check(v) { return typeof v === 'string' && VALID_STATUSES.has(v); }
  },
  conflict: {
    type: 'boolean',
    check(v) { return typeof v === 'boolean'; }
  },
  original_rid: {
    type: 'string',
    check(v) { return typeof v === 'string' && v.startsWith('res_') && v.length > 0; }
  },
  mimetype: {
    type: 'string',
    check(v) { return typeof v === 'string' && v.includes('/') && v.length > 0; }
  },
  size: {
    type: 'number',
    check(v) { return typeof v === 'number' && v >= 0; }
  }
};

/**
 * 校验并规范化 metadata 对象
 *
 * @param {object} metadata - 待校验的 metadata 对象
 * @param {object} [options]
 * @param {string} [options.context] - 调用上下文（用于错误信息），如 'create', 'sync_applyOp'
 * @returns {{ valid: boolean, errors: string[], warnings: string[], normalized: object }}
 */
function validateMetadata(metadata, options = {}) {
  const { context = 'unknown' } = options;

  const errors = [];
  const warnings = [];
  const normalized = {};

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    errors.push(`metadata 必须是非空普通对象，收到: ${JSON.stringify(metadata)}`);
    return { valid: false, errors, warnings, normalized: {} };
  }

  const knownKeys = new Set(Object.keys(FIELD_SCHEMA));
  const inputKeys = Object.keys(metadata);

  for (const key of inputKeys) {
    if (key === '' || key.includes(' ')) {
      errors.push(`[${context}] metadata key 无效: "${key}"（key 不能为空或包含空格）`);
      continue;
    }

    const value = metadata[key];

    if (knownKeys.has(key)) {
      const schema = FIELD_SCHEMA[key];

      // 规范化（如 category 空字符串 → null）
      let finalValue = value;
      if (schema.normalize) {
        finalValue = schema.normalize(value);
      }

      if (!schema.check(finalValue)) {
        const received = typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
        errors.push(
          `[${context}] metadata.${key} 类型错误：期望 ${schema.type}，收到 ${received}`
        );
      } else {
        normalized[key] = finalValue;
      }
    } else {
      // 未知字段：直接报错
      errors.push(
        `[${context}] metadata 包含未知字段 "${key}"（值: ${JSON.stringify(value)}），不允许写入`
      );
    }
  }

  // tags 重复值自动去重
  if (Array.isArray(normalized.tags)) {
    const unique = [...new Set(normalized.tags)];
    if (unique.length !== normalized.tags.length) {
      warnings.push(`[${context}] metadata.tags 包含重复值，已自动去重`);
      normalized.tags = unique;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized
  };
}

/**
 * 严格校验并返回规范化后的 metadata。
 * 校验不通过时抛出详细错误。
 *
 * @param {object} metadata - 待校验的 metadata 对象
 * @param {string} context - 调用上下文标识
 * @returns {object} 规范化后的 metadata
 * @throws {Error} 校验失败时抛出
 */
function assertMetadata(metadata, context = 'unknown') {
  const result = validateMetadata(metadata, { context });

  // 打印警告（不阻塞）
  for (const warn of result.warnings) {
    const Logger = require('./logger.cjs');
    Logger.warn(warn);
  }

  if (!result.valid) {
    const msg = `元数据校验失败 (${context}):\n  - ${result.errors.join('\n  - ')}`;
    throw new Error(msg);
  }

  return result.normalized;
}

module.exports = { validateMetadata, assertMetadata, FIELD_SCHEMA, VALID_STATUSES };
