const RidUtils = require('../utils/rid.cjs');
const HashUtils = require('../utils/hash.cjs');
const ResourceType = require('../utils/resourceType.cjs');
const fs = require('fs-extra');
const path = require('path');

class ResourceService {
  constructor(db) {
    this.db = db;
  }

  async create(resource) {
    const { type, path: filePath, metadata = {} } = resource;
    
    const hash = await HashUtils.fromFile(filePath);
    const now = Date.now();
    
    const rid = RidUtils.generate();
    
    await this.db.run(`
      INSERT INTO resources (rid, type, path, hash, metadata, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [rid, type, filePath, hash, JSON.stringify(metadata), now, now]);
    
    return { rid, type, path: filePath, hash, metadata, created: now, updated: now };
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
    
    const newHash = await HashUtils.fromFile(resource.path);
    
    if (newHash !== resource.hash) {
      return this.update(rid, { hash: newHash });
    }
    
    return resource;
  }

  async _extractMetadata(filePath, type) {
    const metadata = {};
    
    try {
      const stats = await fs.stat(filePath);
      metadata.size = stats.size;
      metadata.mtime = stats.mtime.getTime();
      metadata.ctime = stats.ctime.getTime();
    } catch (e) {
      
    }
    
    if (type === 'note') {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const match = content.match(/^#\s+(.+)$/m);
        if (match) {
          metadata.title = match[1].trim();
        }
        metadata.wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      } catch (e) {
        
      }
    }
    
    return metadata;
  }

  _hydrate(row) {
    return {
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    };
  }
}

module.exports = ResourceService;