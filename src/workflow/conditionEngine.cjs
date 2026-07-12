/**
 * ConditionEngine — 条件引擎
 *
 * Phase 6.3: 评估步骤条件表达式。
 *
 * 支持的表达式:
 *   - 简单比较: score < 0.5, count >= 3, name == "test"
 *   - 逻辑: and, or, not
 *   - 变量引用: $variables.key
 *
 * 示例:
 *   "score < 0.5"
 *   "count >= 10 and type == 'note'"
 *   "$context.variables.isImportant == true"
 */

class ConditionEngine {
  /**
   * @param {object} [services]
   * @param {object} [services.logger]
   */
  constructor(services = {}) {
    this.logger = services.logger || console;
  }

  /**
   * 评估条件表达式
   * @param {object} context — { step, workflowContext, ... }
   * @param {string} expression
   * @returns {boolean}
   */
  evaluate(context, expression) {
    if (!expression || typeof expression !== 'string') return true;

    try {
      // 解析表达式中的变量引用
      const resolved = this._resolveVariables(context, expression);

      // 安全评估（仅限简单比较）
      return this._safeEvaluate(resolved);
    } catch (e) {
      this.logger.error(`[condition] Expression error: ${e.message}`);
      return false;
    }
  }

  /**
   * 解析变量引用
   * $context.variables.key → 实际值
   * $input.key → 上下文输入
   * $results.stepId.key → 步骤结果
   */
  _resolveVariables(context, expression) {
    let resolved = expression;

    // 替换 $variables.key
    if (context.workflowContext) {
      const ctx = context.workflowContext;

      // $variables.key 引用
      const varPattern = /\$variables\.(\w+)/g;
      resolved = resolved.replace(varPattern, (_, key) => {
        const val = ctx.get(key);
        if (val === undefined || val === null) return 'null';
        if (typeof val === 'string') return `'${val}'`;
        return String(val);
      });

      // $results.stepId.key 引用
      const resultPattern = /\$results\.(\w+)\.(\w+)/g;
      resolved = resolved.replace(resultPattern, (_, stepId, key) => {
        const result = ctx.getResult(stepId);
        if (!result) return 'null';
        const val = result[key];
        if (val === undefined || val === null) return 'null';
        if (typeof val === 'string') return `'${val}'`;
        return String(val);
      });

      // $input.key 引用
      const inputPattern = /\$input\.(\w+)/g;
      resolved = resolved.replace(inputPattern, (_, key) => {
        const val = ctx.input[key];
        if (val === undefined || val === null) return 'null';
        if (typeof val === 'string') return `'${val}'`;
        return String(val);
      });
    }

    return resolved;
  }

  /**
   * 安全求值（仅支持简单比较和逻辑运算）
   */
  _safeEvaluate(expression) {
    // 去掉首尾空格
    const expr = expression.trim();

    // 处理逻辑 and / or
    if (/\band\b/i.test(expr)) {
      const parts = expr.split(/\band\b/i);
      return parts.every(p => this._safeEvaluate(p.trim()));
    }

    if (/\bor\b/i.test(expr)) {
      const parts = expr.split(/\bor\b/i);
      return parts.some(p => this._safeEvaluate(p.trim()));
    }

    // 处理 not
    const notMatch = expr.match(/^not\s+(.+)$/i);
    if (notMatch) {
      return !this._safeEvaluate(notMatch[1].trim());
    }

    // 处理比较: a op b
    const compMatch = expr.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (compMatch) {
      const left = this._parseValue(compMatch[1].trim());
      const op = compMatch[2];
      const right = this._parseValue(compMatch[3].trim());

      switch (op) {
        case '==': return left == right;
        case '!=': return left != right;
        case '>=': return left >= right;
        case '<=': return left <= right;
        case '>':  return left > right;
        case '<':  return left < right;
        default: return false;
      }
    }

    // 布尔值直接返回
    if (expr === 'true') return true;
    if (expr === 'false') return false;

    return false;
  }

  /**
   * 解析值
   */
  _parseValue(val) {
    // null
    if (val === 'null') return null;
    // 布尔
    if (val === 'true') return true;
    if (val === 'false') return false;
    // 字符串（单引号或双引号）
    if ((val.startsWith("'") && val.endsWith("'")) ||
        (val.startsWith('"') && val.endsWith('"'))) {
      return val.slice(1, -1);
    }
    // 数字
    const num = Number(val);
    if (!isNaN(num) && val !== '') return num;
    // 其他返回原字符串
    return val;
  }
}

module.exports = ConditionEngine;
