/**
 * SecurityContext — 安全上下文
 *
 * Phase 6.4: 保存当前执行环境的权限信息。
 */

class SecurityContext {
  /**
   * @param {object} opts
   * @param {import('./subject.cjs')} [opts.subject]
   * @param {string[]} [opts.roles] — 角色 ID 列表
   * @param {string[]} [opts.permissions] — 直接授予的权限
   */
  constructor({ subject, roles, permissions } = {}) {
    this.subject = subject || require('./subject.cjs').currentUser();
    this.roles = roles || ['owner'];
    this.permissions = permissions || [];
  }

  /**
   * 获取所有有效权限
   */
  getAllPermissions(permissionManager) {
    const perms = new Set();

    // 角色权限
    for (const roleId of this.roles) {
      if (permissionManager) {
        const role = permissionManager.getRole(roleId);
        if (role) {
          for (const p of role.permissionCodes) {
            perms.add(p);
          }
        }
      }
    }

    // 直接权限
    for (const p of this.permissions) {
      perms.add(p);
    }

    return Array.from(perms);
  }
}

module.exports = SecurityContext;
