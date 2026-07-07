const RidUtils = require('../utils/rid.cjs');
const HashUtils = require('../utils/hash.cjs');
const ResourceType = require('../utils/resourceType.cjs');
const { assertMetadata } = require('../utils/validateMetadata.cjs');
const fs = require('fs-extra');
const path = require('path');

class ResourceService {
  /**
   * @param {import('./database.cjs')} db
   * @param {{ getCryptoKey?: () => Buffer|null }} options
   */
  constructor(db, options = {}) {
    this.db = db;
    /** 懒加载加密密钥获取函数（仅内存中存在） */
    this._getCryptoKey = options.getCryptoKey || null;
  }

  /**
   * 获取当前加密密钥
   * @returns {Buffer|null}
   */
  get _cryptoKey() {
    return this._getCryptoKey ? this._getCryptoKey() : null;
  }

  /**
   * 读取文件内容（自动处理加密/明文）
   * @param {string} filePath
   * @param {string} [encoding]
   * @returns {Promise<Buffer|string>}
   */
  async _readFile(filePath, encoding) {
    const raw = await fs.readFile(filePath);
    const CryptoUtils = require('../utils/crypto.cjs');

    // 检测是否为加密文件
    if (raw.length >= 4 && raw.subarray(0, 4).equals(CryptoUtils.MAGIC)) {
      const key = this._cryptoKey;
      if (!key) {
        throw new Error(`文件已加密但无法获取解密密钥: ${filePath}。请确保已通过 SSH 认证。`);
      }
      const decrypted = CryptoUtils.decryptFile(raw, key);
      return encoding ? decrypted.toString(encoding) : decrypted;
    }

    return encoding ? raw.toString(encoding) : raw;
  }

  /**
   * 写入文件内容（自动加密）
   * @param {string} filePath
   * @param {Buffer|string} data
   */
  async _writeFile(filePath, data) {
    const CryptoUtils = require('../utils/crypto.cjs');
    const key = this._cryptoKey;
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');

    await fs.ensureDir(path.dirname(filePath));

    if (key) {
      // 有加密密钥 → 加密写入
      const encrypted = CryptoUtils.encryptFile(buf, key);
      await fs.writeFile(filePath, encrypted);
    } else {
      // 无加密密钥 → 明文写入
      await fs.writeFile(filePath, buf);
    }
  }

  /**
   * 创建资源（入库）
   * @param {object} resource
   * @param {string} resource.type - 资源类型
   * @param {string} resource.path - 文件路径
   * @param {string} [resource.rid] - 预生成的 RID（可选，不提供则自动生成）
   * @param {string} resource.name - 资源逻辑名称（全局唯一）
   * @param {object} [resource.metadata] - 元数据
   */
  async create(resource) {
    const { type, path: filePath, metadata: callerMeta = {}, rid: preRid } = resource;
    let { name } = resource;

    if (!name) {
      // 从文件路径推导名称
      // 去掉日期前缀 (YYYY-MM-DD-) 和随机后缀 (-xxxxxxxx)
      // 例如: 2026-07-07-我的笔记-a1b2c3d4.md → 我的笔记
      const basename = path.basename(filePath, path.extname(filePath));
      name = basename
        .replace(/^\d{4}-\d{2}-\d{2}-/, '')   // 去掉日期前缀
        .replace(/-[a-f0-9]{8}$/, '');         // 去掉随机后缀
    }

    // 确定 layer：同名时自动入栈（layer 1~19），否则 layer 0（活跃）
    let layer = 0;
    const active = await this.getByName(name);  // 只查 layer=0
    if (active) {
      // 同名冲突 → 找下一个可用栈层级
      const stack = await this.getStack(name);
      const usedLayers = new Set(stack.map(r => r.layer));
      for (let l = 1; l < 20; l++) {
        if (!usedLayers.has(l)) {
          layer = l;
          break;
        }
      }
      if (layer === 0) {
        throw new Error(`资源名称 "${name}" 栈已满（最多 20 层，含活跃层），无法入栈。请先 lo stack drop 释放空间。`);
      }
    }

    // 自动提取元数据（title, wordCount, size, mtime），调用方传入的优先级更高
    const extracted = await this._extractMetadata(filePath, type);
    const metadata = assertMetadata({ ...extracted, ...callerMeta }, 'resourceService.create');

    const contentBuffer = await fs.readFile(filePath);
    const CryptoUtils = require('../utils/crypto.cjs');

    // 检测是否为已加密文件
    const alreadyEncrypted = contentBuffer.length >= 4 &&
      contentBuffer.subarray(0, 4).equals(CryptoUtils.MAGIC);

    // 计算明文散列（用于变更检测），未加密文件直接散列，已加密文件需要先解密
    let plainHash;
    if (alreadyEncrypted) {
      if (!this._cryptoKey) {
        throw new Error(`文件已加密但无法获取解密密钥: ${filePath}。请确保已通过 SSH 认证。`);
      }
      const plaintext = CryptoUtils.decryptFile(contentBuffer, this._cryptoKey);
      plainHash = HashUtils.fromBuffer(plaintext);
    } else {
      plainHash = HashUtils.fromBuffer(contentBuffer);
      // 如果有加密密钥可用且文件未加密，则加密
      if (this._cryptoKey) {
        await CryptoUtils.writeEncryptedFile(filePath, contentBuffer, this._cryptoKey);
      }
    }

    const now = Date.now();
    const rid = preRid || RidUtils.generate();
    const encrypted = alreadyEncrypted || !!this._cryptoKey;

    await this.db.run(`
      INSERT INTO resources (rid, name, layer, type, path, hash, metadata, encrypted, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [rid, name, layer, type, filePath, plainHash, JSON.stringify(metadata), encrypted ? 1 : 0, now, now]);

    return { rid, name, layer, type, path: filePath, hash: plainHash, metadata, encrypted, created: now, updated: now };
  }

  async getByRid(rid) {
    const row = await this.db.get(`
      SELECT * FROM resources WHERE rid = ? AND deleted = 0
    `, [rid]);
    
    if (!row) return null;
    
    return this._hydrate(row);
  }

  async getByName(name) {
    // 默认只返回活跃层（layer=0）
    const row = await this.db.get(`
      SELECT * FROM resources WHERE name = ? AND layer = 0 AND deleted = 0
    `, [name]);
    
    if (!row) return null;
    
    return this._hydrate(row);
  }

  async getByNameLayer(name, layer) {
    const row = await this.db.get(`
      SELECT * FROM resources WHERE name = ? AND layer = ? AND deleted = 0
    `, [name, layer]);
    
    if (!row) return null;
    
    return this._hydrate(row);
  }

  /**
   * 获取指定名称的完整栈（所有层，按 layer 排序）
   * @param {string} name
   * @returns {Promise<Array>}
   */
  async getStack(name) {
    const rows = await this.db.all(`
      SELECT * FROM resources WHERE name = ? AND deleted = 0 ORDER BY layer ASC
    `, [name]);
    
    return rows.map(row => this._hydrate(row));
  }

  /**
   * 出栈：将栈顶（最小 layer>0）提升为活跃层（layer=0），原活跃层压入栈
   * @param {string} name
   * @returns {Promise<object>} 新的活跃层资源
   */
  async popFromStack(name) {
    const stack = await this.getStack(name);
    if (stack.length < 2) {
      throw new Error(`资源 "${name}" 栈中没有可弹出的层`);
    }

    // stack[0] = 活跃层 (layer=0), stack[1] = 栈顶（layer 最小且 >0）
    const active = stack[0];
    const top = stack[1];
    const targetLayer = top.layer; // 栈顶原来的层号

    // 三步交换，避免 UNIQUE(name,layer) 约束冲突：
    // 1. 活跃层 → 临时负值，释放 layer=0
    // 2. 栈顶   → layer=0
    // 3. 旧活跃 → 栈顶原来的层号
    await this.db.run('UPDATE resources SET layer = ? WHERE rid = ?', [-1, active.rid]);
    try {
      await this.db.run('UPDATE resources SET layer = ? WHERE rid = ?', [0, top.rid]);
      await this.db.run('UPDATE resources SET layer = ? WHERE rid = ?', [targetLayer, active.rid]);
    } catch (e) {
      // 回滚：将活跃层恢复到 layer=0
      await this.db.run('UPDATE resources SET layer = ? WHERE rid = ?', [0, active.rid]);
      throw e;
    }

    return this.getByRid(top.rid);
  }

  /**
   * 丢弃指定层
   * @param {string} name
   * @param {number} layer - 层号（不能为 0）
   */
  async dropLayer(name, layer) {
    if (layer === 0) {
      throw new Error('不能丢弃活跃层（layer=0），请先 pop 或 delete');
    }
    const resource = await this.getByNameLayer(name, layer);
    if (!resource) {
      throw new Error(`资源 "${name}" 的 layer ${layer} 不存在`);
    }
    // 硬删除
    await this.db.run('DELETE FROM resources WHERE rid = ?', [resource.rid]);
    await this.db.run('DELETE FROM relations WHERE from_rid = ? OR to_rid = ?', [resource.rid, resource.rid]);
    return { rid: resource.rid, dropped: true };
  }

  async getByPath(filePath) {
    const row = await this.db.get(`
      SELECT * FROM resources WHERE path = ? AND deleted = 0
    `, [filePath]);
    
    if (!row) return null;
    
    return this._hydrate(row);
  }

  async getByHash(filePath) {
    const hash = await HashUtils.fromFile(filePath, this._cryptoKey);
    const row = await this.db.get(`
      SELECT * FROM resources WHERE hash = ? AND deleted = 0
    `, [hash]);
    
    if (!row) return null;
    
    return this._hydrate(row);
  }

  async getAll(options = {}) {
    const { type, limit, offset, activeOnly } = options;
    
    let sql = 'SELECT * FROM resources WHERE deleted = 0';
    const params = [];
    
    if (activeOnly) {
      sql += ' AND layer = 0';
    }
    
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    
    sql += ' ORDER BY created DESC';
    
    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }
    
    if (offset) {
      sql += ' OFFSET ?';
      params.push(offset);
    }
    
    const rows = await this.db.all(sql, params);
    return rows.map(row => this._hydrate(row));
  }

  async update(rid, updates) {
    const { path, hash, metadata } = updates;
    
    let sql = 'UPDATE resources SET updated = ?';
    const params = [Date.now()];
    
    if (path) {
      sql += ', path = ?';
      params.push(path);
    }
    
    if (hash) {
      sql += ', hash = ?';
      params.push(hash);
    }
    
    if (metadata) {
      const validated = assertMetadata(metadata, 'resourceService.update');
      sql += ', metadata = ?';
      params.push(JSON.stringify(validated));
    }
    
    sql += ' WHERE rid = ? AND deleted = 0';
    params.push(rid);
    
    const result = await this.db.run(sql, params);
    
    if (result.changes === 0) {
      throw new Error('Resource not found');
    }
    
    return this.getByRid(rid);
  }

  async delete(rid, soft = true) {
    if (soft) {
      // 软删除前释放名称（追加 rid 后缀），允许同名资源重新创建
      const resource = await this.getByRid(rid);
      if (resource && resource.name) {
        await this.db.run(`
          UPDATE resources SET name = ?, deleted = 1, updated = ? WHERE rid = ?
        `, [`${resource.name}_del_${rid.slice(-8)}`, Date.now(), rid]);
      } else {
        await this.db.run(`
          UPDATE resources SET deleted = 1, updated = ? WHERE rid = ?
        `, [Date.now(), rid]);
      }
    } else {
      await this.db.run(`
        DELETE FROM resources WHERE rid = ?
      `, [rid]);
      
      await this.db.run(`
        DELETE FROM relations WHERE from_rid = ? OR to_rid = ?
      `, [rid, rid]);
    }
    
    return { rid, deleted: true };
  }

  async importFile(filePath, type = null, options = {}) {
    // 先按路径检查
    const existing = await this.getByPath(filePath);
    if (existing) {
      return existing;
    }
    
    const resourceType = type || ResourceType.fromPath(filePath);
    const metadata = await this._extractMetadata(filePath, resourceType);

    // 推导名称（去掉日期前缀和随机后缀）
    // 例如: 2026-07-07-我的笔记-a1b2c3d4.md → 我的笔记
    const basename = path.basename(filePath, path.extname(filePath));
    let name = basename
      .replace(/^\d{4}-\d{2}-\d{2}-/, '')   // 去掉日期前缀
      .replace(/-[a-f0-9]{8}$/, '');         // 去掉随机后缀

    // 重名校验（交给 create 统一报错）
    
    return this.create({
      type: resourceType,
      path: filePath,
      name,
      metadata,
      ...options
    });
  }

  async move(rid, newPath) {
    const resource = await this.getByRid(rid);
    if (!resource) {
      throw new Error('Resource not found');
    }
    
    await fs.move(resource.path, newPath);
    
    return this.update(rid, { path: newPath });
  }

  // 仅更新 DB 路径，不移动磁盘文件（用于 sync 检测到重命名时文件已在目标位置）
  async updatePath(rid, newPath) {
    return this.update(rid, { path: newPath });
  }

  async rehash(rid) {
    const resource = await this.getByRid(rid);
    if (!resource) {
      throw new Error('Resource not found');
    }

    // 读取文件内容并计算明文散列（加密文件需要先解密再散列）
    const rawBuffer = await fs.readFile(resource.path);
    const CryptoUtils = require('../utils/crypto.cjs');

    let plaintextBuffer;
    const isEncrypted = rawBuffer.length >= 4 &&
      rawBuffer.subarray(0, 4).equals(CryptoUtils.MAGIC);

    if (isEncrypted) {
      if (!this._cryptoKey) {
        throw new Error(`文件已加密但无法获取解密密钥: ${resource.path}。请确保已通过 SSH 认证。`);
      }
      plaintextBuffer = CryptoUtils.decryptFile(rawBuffer, this._cryptoKey);
    } else {
      plaintextBuffer = rawBuffer;
    }

    const newHash = HashUtils.fromBuffer(plaintextBuffer);

    if (newHash !== resource.hash) {
      return this.update(rid, { hash: newHash });
    }

    return resource;
  }

  async refresh(rid) {
    const resource = await this.getByRid(rid);
    if (!resource) {
      throw new Error('Resource not found');
    }

    const newMeta = await this._extractMetadata(resource.path, resource.type);

    const rawBuffer = await fs.readFile(resource.path);
    const CryptoUtils = require('../utils/crypto.cjs');
    let plaintextBuffer;
    if (rawBuffer.length >= 4 && rawBuffer.subarray(0, 4).equals(CryptoUtils.MAGIC)) {
      if (!this._cryptoKey) {
        throw new Error('文件已加密但无法获取解密密钥');
      }
      plaintextBuffer = CryptoUtils.decryptFile(rawBuffer, this._cryptoKey);
    } else {
      plaintextBuffer = rawBuffer;
    }
    const newHash = HashUtils.fromBuffer(plaintextBuffer);

    const updates = { hash: newHash };
    // 合并新元数据到现有元数据（保留 tags/status 等手动设置的字段）
    const merged = { ...resource.metadata, ...newMeta };
    if (JSON.stringify(merged) !== JSON.stringify(resource.metadata) || newHash !== resource.hash) {
      updates.metadata = merged;
    }

    return this.update(rid, updates);
  }

  async _extractMetadata(filePath, type) {
    const metadata = {};

    // 注意：不记录 mtime/ctime，因为加密等操作会修改文件时间戳，
    // 导致后续 sync 的 metadata 比较误判为变更。
    // sync 的增量检测直接使用 fs.stat().mtime。

    if (type === 'note') {
      try {
        const content = await this._readFile(filePath, 'utf-8');
        const match = content.match(/^#\s+(.+)$/m);
        if (match) {
          metadata.title = match[1].trim();
        }
        metadata.wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      } catch (e) {
        // 忽略内容解析错误
      }
    }

    return metadata;
  }

  /**
   * 判断指定路径的文件是否加密（通过魔数检测）
   * @param {string} filePath - 文件路径
   * @returns {boolean}
   */
  isEncrypted(filePath) {
    const CryptoUtils = require('../utils/crypto.cjs');
    return CryptoUtils.isEncryptedFile(filePath);
  }

  _hydrate(row) {
    return {
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      encrypted: row.encrypted === 1 || row.encrypted === true
    };
  }
}

module.exports = ResourceService;