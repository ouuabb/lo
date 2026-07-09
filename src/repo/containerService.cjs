const fs = require('fs-extra');
const path = require('path');
const HashUtils = require('../utils/hash.cjs');
const ResourceType = require('../utils/resourceType.cjs');

/**
 * ContainerService - 管理具有 Container Capability 的 Resource 的成员
 *
 * 负责:
 *   - 从 Content Source 扫描并添加成员
 *   - 管理 container_members 表
 *   - Promote: 将普通 File Member 提升为独立 Resource
 */
class ContainerService {
  /**
   * @param {import('./database.cjs')} db
   * @param {import('./resourceService.cjs')} resourceService
   * @param {{ getCryptoKey?: () => Buffer|null }} options
   */
  constructor(db, resourceService, options = {}) {
    this.db = db;
    this.resourceService = resourceService;
    this._getCryptoKey = options.getCryptoKey || null;
  }

  get _cryptoKey() {
    return this._getCryptoKey ? this._getCryptoKey() : null;
  }

  /**
   * 检查 Resource 是否具有 Container Capability
   * @param {string} rid
   * @returns {Promise<boolean>}
   */
  async hasContainerCapability(rid) {
    const resource = await this.resourceService.getByRid(rid);
    if (!resource) return false;
    const caps = resource.capabilities || [];
    return caps.includes('container');
  }

  /**
   * 获取容器的 Container Schema（允许的成员类型等）
   * @param {string} containerRid
   * @returns {Promise<object>}
   */
  async getContainerSchema(containerRid) {
    const resource = await this.resourceService.getByRid(containerRid);
    if (!resource) return {};
    return resource.container_schema || {};
  }

  /**
   * 扫描 Content Source 目录，将其中的文件作为成员添加到容器
   * @param {string} containerRid - 容器 Resource 的 RID
   * @param {string} sourceDir - 要扫描的源目录路径
   * @param {{ recursive?: boolean, filter?: RegExp }} options
   * @returns {Promise<{ added: number, skipped: number, errors: Array }>}
   */
  async scanSource(containerRid, sourceDir, options = {}) {
    const { recursive = true, filter = null } = options;

    if (!await this.hasContainerCapability(containerRid)) {
      throw new Error(`Resource ${containerRid} 不具有 Container Capability`);
    }

    const schema = await this.getContainerSchema(containerRid);
    const allowedTypes = (schema.allowed_types && schema.allowed_types.length > 0) ? schema.allowed_types : null;

    if (!await fs.pathExists(sourceDir)) {
      throw new Error(`源目录不存在: ${sourceDir}`);
    }

    // 扫描文件
    const files = [];
    await this._scanDir(sourceDir, sourceDir, recursive, files);

    const result = { added: 0, skipped: 0, errors: [] };

    for (const file of files) {
      try {
        // 类型过滤
        if (filter && !filter.test(file.relPath)) continue;

        const ext = path.extname(file.absPath).toLowerCase();
        const memberType = ResourceType.fromPath(file.absPath);

        // 检查容器类型限制
        if (allowedTypes && !allowedTypes.includes(memberType)) {
          result.skipped++;
          continue;
        }

        const stats = await fs.stat(file.absPath);
        const relPath = path.relative(sourceDir, file.absPath).replace(/\\/g, '/');

        // 计算 hash（自动处理加密文件）
        const fileHash = await HashUtils.fromFile(file.absPath, this._cryptoKey);

        await this.addMember(containerRid, {
          path: relPath,
          absolutePath: file.absPath,
          name: path.basename(file.absPath),
          size: stats.size,
          hash: fileHash,
          modified_time: stats.mtime.getTime()
        });

        result.added++;
      } catch (e) {
        result.errors.push({ file: file.absPath, error: e.message });
      }
    }

    return result;
  }

  /**
   * 递归扫描目录
   */
  async _scanDir(baseDir, currentDir, recursive, result) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const absPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (recursive && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await this._scanDir(baseDir, absPath, recursive, result);
          }
        } else if (entry.isFile()) {
          if (ResourceType.isSupported(absPath)) {
            result.push({ absPath, relPath: path.relative(baseDir, absPath).replace(/\\/g, '/') });
          }
        }
      }
    } catch (e) {
      // 目录读取失败，静默跳过
    }
  }

  /**
   * 添加成员到容器
   * @param {string} containerRid
   * @param {object} member
   * @param {string} member.path - 容器内的相对路径
   * @param {string} [member.absolutePath] - 磁盘上的绝对路径（用于 hash 计算）
   * @param {string} member.name - 文件名
   * @param {number} member.size - 文件大小
   * @param {string} member.hash - 内容哈希
   * @param {number} member.modified_time - 修改时间
   * @param {object} [member.metadata] - 元数据
   * @returns {Promise<object>}
   */
  async addMember(containerRid, member) {
    const { path: memberPath, absolutePath, name, size, hash,
            modified_time, metadata = {} } = member;

    // 计算 hash（如果提供了 absolutePath 但未提供 hash）
    let memberHash = hash;
    if (!memberHash && absolutePath) {
      memberHash = await HashUtils.fromFile(absolutePath, this._cryptoKey);
    }

    // 检查是否已存在
    const existing = await this.db.get(
      'SELECT id FROM container_members WHERE container_rid = ? AND path = ?',
      [containerRid, memberPath]
    );

    if (existing) {
      // 更新已有成员
      await this.db.run(
        `UPDATE container_members
         SET name = ?, size = ?, hash = ?, modified_time = ?, metadata = ?
         WHERE id = ?`,
        [name, size || 0, memberHash, modified_time || Date.now(),
         JSON.stringify(metadata), existing.id]
      );
      return { id: existing.id, container_rid: containerRid, path: memberPath, updated: true };
    }

    // 插入新成员
    const result = await this.db.run(
      `INSERT INTO container_members (container_rid, resource_rid, path, name, size, hash, modified_time, metadata)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
      [containerRid, memberPath, name, size || 0, memberHash || '',
       modified_time || Date.now(), JSON.stringify(metadata)]
    );

    return { id: result.lastID, container_rid: containerRid, path: memberPath, added: true };
  }

  /**
   * 移除成员
   * @param {string} containerRid
   * @param {number|string} memberIdOrPath - 成员 ID 或路径
   * @returns {Promise<{ removed: boolean }>}
   */
  async removeMember(containerRid, memberIdOrPath) {
    let result;
    if (typeof memberIdOrPath === 'number') {
      result = await this.db.run(
        'DELETE FROM container_members WHERE id = ? AND container_rid = ?',
        [memberIdOrPath, containerRid]
      );
    } else {
      result = await this.db.run(
        'DELETE FROM container_members WHERE path = ? AND container_rid = ?',
        [memberIdOrPath, containerRid]
      );
    }

    return { removed: result.changes > 0 };
  }

  /**
   * 获取容器的所有成员
   * @param {string} containerRid
   * @param {{ resourceOnly?: boolean, fileOnly?: boolean }} options
   * @returns {Promise<Array>}
   */
  async getMembers(containerRid, options = {}) {
    const { resourceOnly = false, fileOnly = false } = options;

    let sql = 'SELECT * FROM container_members WHERE container_rid = ?';
    const params = [containerRid];

    if (resourceOnly) {
      sql += ' AND resource_rid IS NOT NULL';
    } else if (fileOnly) {
      sql += ' AND resource_rid IS NULL';
    }

    sql += ' ORDER BY path ASC';

    const rows = await this.db.all(sql, params);
    return rows.map(row => this._hydrateMember(row));
  }

  /**
   * 按路径获取单个成员
   * @param {string} containerRid
   * @param {string} memberPath
   * @returns {Promise<object|null>}
   */
  async getMember(containerRid, memberPath) {
    const row = await this.db.get(
      'SELECT * FROM container_members WHERE container_rid = ? AND path = ?',
      [containerRid, memberPath]
    );
    return row ? this._hydrateMember(row) : null;
  }

  /**
   * Promote: 将普通 File Member 提升为独立的 Resource
   *
   * 流程:
   *   1. 创建新的 Resource（type 根据文件推导）
   *   2. 更新 container_members 的 resource_rid 指向新 Resource
   *   3. 新 Resource 拥有独立 RID，可以参与 Relation
   *
   * @param {string} containerRid - 容器 RID
   * @param {string} memberPath - 成员在容器中的路径
   * @param {{ type?: string, metadata?: object }} options
   * @returns {Promise<object>} 新创建的 Resource
   */
  async promoteMember(containerRid, memberPath, options = {}) {
    const member = await this.getMember(containerRid, memberPath);
    if (!member) {
      throw new Error(`成员不存在: ${memberPath}`);
    }

    if (member.resource_rid) {
      // 已经是 Resource Member，直接返回
      return this.resourceService.getByRid(member.resource_rid);
    }

    // 获取容器 Resource 以确定绝对路径
    const container = await this.resourceService.getByRid(containerRid);
    if (!container) {
      throw new Error(`容器 Resource 不存在: ${containerRid}`);
    }

    // 从 Content Source 获取成员的绝对路径
    const sources = await this.db.all(
      'SELECT * FROM resource_sources WHERE resource_rid = ?',
      [containerRid]
    );

    let absolutePath = null;
    for (const src of sources) {
      const candidate = path.join(src.location, memberPath).replace(/\\/g, '/');
      if (await fs.pathExists(candidate)) {
        absolutePath = candidate;
        break;
      }
    }

    if (!absolutePath) {
      throw new Error(`无法找到成员的磁盘文件: ${memberPath}。请确保 Content Source 仍然存在。`);
    }

    // 创建 Resource
    const resourceType = options.type || ResourceType.fromPath(absolutePath);
    const resource = await this.resourceService.create({
      type: resourceType,
      path: absolutePath,
      name: member.name.replace(/\.[^.]+$/, ''),  // 去掉扩展名
      metadata: options.metadata || {},
      capabilities: []
    });

    // 更新 member 的 resource_rid
    await this.db.run(
      'UPDATE container_members SET resource_rid = ? WHERE id = ?',
      [resource.rid, member.id]
    );

    return resource;
  }

  /**
   * 获取所有包含某个 Resource 作为成员的容器
   * @param {string} resourceRid
   * @returns {Promise<Array>}
   */
  async getContainersForResource(resourceRid) {
    const rows = await this.db.all(
      'SELECT * FROM container_members WHERE resource_rid = ?',
      [resourceRid]
    );
    return rows.map(row => this._hydrateMember(row));
  }

  /**
   * Demote: 将已提升的 Resource Member 降级为普通 File Member
   *
   * 流程:
   *   1. 找到容器中的成员记录
   *   2. 将 resource_rid 设置为 NULL
   *   3. 成员恢复为普通文件成员（不再关联独立 Resource）
   *
   * 注意: 降级不会删除 Resource 本身，Resource 仍然独立存在。
   * 如需删除 Resource，请使用 lo delete <rid>。
   *
   * @param {string} containerRid - 容器 RID
   * @param {string} memberPath - 成员在容器中的路径
   * @returns {Promise<object>} { demoted: true, resource_rid: string }
   */
  async demoteMember(containerRid, memberPath) {
    const member = await this.getMember(containerRid, memberPath);
    if (!member) {
      throw new Error(`成员不存在: ${memberPath}`);
    }

    if (!member.resource_rid) {
      throw new Error(`成员 "${memberPath}" 尚未提升，无法降级`);
    }

    // 检查关联的 Resource 是否还存在
    const resource = await this.resourceService.getByRid(member.resource_rid);

    // 将 resource_rid 设置为 NULL，恢复为普通 File Member
    await this.db.run(
      'UPDATE container_members SET resource_rid = NULL WHERE id = ?',
      [member.id]
    );

    return {
      demoted: true,
      container_rid: containerRid,
      path: memberPath,
      resource_rid: member.resource_rid,
      resource_exists: !!resource
    };
  }

  /**
   * 获取容器的成员统计
   * @param {string} containerRid
   * @returns {Promise<{ total: number, resources: number, files: number }>}
   */
  async getMemberStats(containerRid) {
    const total = await this.db.get(
      'SELECT COUNT(*) as count FROM container_members WHERE container_rid = ?',
      [containerRid]
    );
    const resources = await this.db.get(
      'SELECT COUNT(*) as count FROM container_members WHERE container_rid = ? AND resource_rid IS NOT NULL',
      [containerRid]
    );

    return {
      total: total ? total.count : 0,
      resources: resources ? resources.count : 0,
      files: (total ? total.count : 0) - (resources ? resources.count : 0)
    };
  }

  _hydrateMember(row) {
    return {
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {})
    };
  }
}

module.exports = ContainerService;
