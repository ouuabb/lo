/**
 * PolicyEngine — 策略引擎
 *
 * Phase 6.4: 核心权限决策模块。
 *
 * 流程:
 *   Can(subject, action, resource)?
 *     1. 检查 Subject 直接权限
 *     2. 检查 Role 权限
 *     3. 检查 Resource ACL（如果指定了 resource）
 *     4. 返回 { allowed, reason }
 */

const Permission = require('./permission.cjs');
const ResourcePolicy = require('./resourcePolicy.cjs');

class PolicyEngine {
  /**
   * @param {object} services
   * @param {import('./permissionManager.cjs')} services.permissionManager
   * @param {import('./permissionAudit.cjs')} [services.audit]
   * @param {object} [services.logger]
   */
  constructor(services = {}) {
    this.permissionManager = services.permissionManager || null;
    this.audit = services.audit || null;
    this.logger = services.logger || console;
  }

  /**
   * 检查权限
   * @param {string|import('./subject.cjs')} subject
   * @param {string} action — 权限代码，如 'resource.read'
   * @param {string} [resource] — 资源 RID（可选，用于 ACL）
   * @returns {{ allowed: boolean, reason: string }}
   */
  async check(subject, action, resource) {
    const subjectId = typeof subject === 'string' ? subject : subject.id;
    const perm = new Permission(action);

    // 1. 检查 Role 权限
    if (this.permissionManager) {
      const roles = this.permissionManager.getSubjectRoles(subjectId);

      for (const role of roles) {
        if (role.hasPermission(action)) {
          await this._audit(subjectId, action, resource, true, `role:${role.id}`);
          return { allowed: true, reason: `role:${role.id}` };
        }
      }

      // 2. 检查直接权限
      const directPerms = this.permissionManager.getSubjectPermissions(subjectId);
      for (const dp of directPerms) {
        if (perm.matches(dp)) {
          await this._audit(subjectId, action, resource, true, 'direct_grant');
          return { allowed: true, reason: 'direct_grant' };
        }
      }

      // 3. 检查 Resource ACL
      if (resource) {
        const acl = this.permissionManager.getResourceACL(resource);
        if (acl) {
          const aclResult = acl.check(subjectId, action);
          if (aclResult !== null) {
            await this._audit(subjectId, action, resource, aclResult.allowed, aclResult.reason);
            return aclResult;
          }
        }
      }
    }

    // 默认：单用户系统允许所有操作
    await this._audit(subjectId, action, resource, true, 'default_allow');
    return { allowed: true, reason: 'default_allow' };
  }

  /**
   * 快速检查（不审计）
   */
  async can(subject, action, resource) {
    const result = await this.check(subject, action, resource);
    return result.allowed;
  }

  /**
   * 批量检查
   */
  async batchCheck(subject, actions, resource) {
    const results = {};
    for (const action of actions) {
      results[action] = await this.check(subject, action, resource);
    }
    return results;
  }

  async _audit(subject, action, resource, allowed, reason) {
    if (this.audit) {
      try {
        await this.audit.record(subject, action, resource, allowed, reason);
      } catch {}
    }
  }
}

module.exports = PolicyEngine;
