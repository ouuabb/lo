const RidUtils = require('../utils/rid.cjs');
const HashUtils = require('../utils/hash.cjs');
const ResourceType = require('../utils/resourceType.cjs');
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

  async create(resource) {
    const { type, path: filePath, metadata: callerMeta = {} } = resource;

    // 自动提取元数据（title, wordCount, size, mtime），调用方传入的优先级更高
    const extracted = await this._extractMetadata(filePath, type);
    const metadata = { ...extracted, ...callerMeta };

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
    const rid = RidUtils.generate();
    const encrypted = alreadyEncrypted || !!this._cryptoKey;

    await this.db.run(`
      INSERT INTO resources (rid, type, path, hash, metadata, encrypted, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [rid, type, filePath, plainHash, JSON.stringify(metadata), encrypted ? 1 : 0, now, now]);

    return { rid, type, path: filePath, hash: plainHash, metadata, encrypted, created: now, updated: now };
  }

  async getByRid(rid) {
    const row = await this.db.get(`
      SELECT * FROM resources WHERE rid = ? AND deleted = 0
    `, [rid]);
    
    if (!row) return null;
    
    return this._hydrate(row);
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
    const { type, limit, offset } = options;
    
    let sql = 'SELECT * FROM resources WHERE deleted = 0';
    const params = [];
    
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
      sql += ', metadata = ?';
      params.push(JSON.stringify(metadata));
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
      await this.db.run(`
        UPDATE resources SET deleted = 1, updated = ? WHERE rid = ?
      `, [Date.now(), rid]);
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

  async importFile(filePath, type = null) {
    const existing = await this.getByPath(filePath);
    if (existing) {
      return existing;
    }
    
    const resourceType = type || ResourceType.fromPath(filePath);
    
    const metadata = await this._extractMetadata(filePath, resourceType);
    
    return this.create({
      type: resourceType,
      path: filePath,
      metadata
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

    try {
      const stats = await fs.stat(filePath);
      metadata.size = stats.size;
      metadata.mtime = stats.mtime.getTime();
      metadata.ctime = stats.ctime.getTime();
    } catch (e) {
      // 忽略文件状态读取错误
    }

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