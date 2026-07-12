const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  权限系统（Phase 6.4）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.bold.yellow('\n  一、概述'));
    console.log(`
  lo 权限系统基于 RBAC（基于角色的访问控制）和 ABAC
  （基于属性的访问控制）混合模型，提供精细的访问控制。

  核心组件：
    - PermissionEngine — 权限检查引擎
    - RoleManager      — 角色定义与管理
    - PolicyEngine     — ABAC 策略引擎
    - ACLManager       — 资源级访问控制列表
    - AuditLogger      — 审计日志`);

    console.log(chalk.bold.yellow('\n  二、RBAC 角色模型'));
    console.log(`
  预定义角色：

  角色        权限范围
  ──────────  ──────────────────────────────────
  admin       完全控制：所有资源的读写删
  editor      编辑权限：创建、修改资源
  viewer      只读权限：查看资源、搜索
  contributor 贡献权限：创建资源、修改自己的
  auditor     审计权限：只读 + 审计日志查看

  角色可以自定义，通过 lo permission role 管理。`);

    console.log(chalk.bold.yellow('\n  三、ABAC 策略'));
    console.log(`
  ABAC 策略引擎根据资源属性、主体属性和环境上下文做决策：

  策略结构：
    {
      effect: "allow" | "deny",
      subject: { role, ... },
      action: "resource.read" | "resource.write" | ...,
      resource: { type, tags, category, ... },
      condition: { time, ip, ... }
    }

  策略优先级：
    显式 deny > 显式 allow > 默认 deny`);

    console.log(chalk.bold.yellow('\n  四、资源级 ACL'));
    console.log(`
  每个资源可以有独立的访问控制列表（ACL）：

    - 按用户/角色设置读写权限
    - 支持继承（子资源继承父容器的 ACL）
    - 可通过 lo permission grant 命令行管理`);

    console.log(chalk.bold.yellow('\n  五、审计日志'));
    console.log(`
  审计系统记录所有权限相关操作：

  记录内容：
    - 谁（subject）在何时（timestamp）
    - 做了什么（action）
    - 对哪个资源（resource）
    - 结果如何（allow/deny）
    - 来源 IP 和上下文`);

    console.log(chalk.gray('\n  相关命令：'));
    console.log(chalk.gray('    lo permission role/check/grant/audit'));
    console.log(chalk.gray('    lo manual permission'));
    console.log('');
};
