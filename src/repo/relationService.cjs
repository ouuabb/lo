class RelationService {
  constructor(db) {
    this.db = db;
  }

  async create(fromRid, toRid, type = 'reference') {
    const now = Date.now();
    
    try {
      await this.db.run(`
        INSERT INTO relations (from_rid, to_rid, type, created)
        VALUES (?, ?, ?, ?)
      `, [fromRid, toRid, type, now]);
      
      return { from_rid: fromRid, to_rid: toRid, type, created: now };
    } catch (e) {
      if (e.message.includes('UNIQUE')) {
        throw new Error('Relation already exists');
      }
      throw e;
    }
  }

  async remove(fromRid, toRid, type) {
    const result = await this.db.run(`
      DELETE FROM relations WHERE from_rid = ? AND to_rid = ? AND type = ?
    `, [fromRid, toRid, type]);
    
    return { removed: result.changes > 0 };
  }

  async getByFromRid(rid) {
    const rows = await this.db.all(`
      SELECT * FROM relations WHERE from_rid = ?
    `, [rid]);
    
    return rows;
  }

  async getByToRid(rid) {
    const rows = await this.db.all(`
      SELECT * FROM relations WHERE to_rid = ?
    `, [rid]);
    
    return rows;
  }

  async getRelations(rid) {
    const outgoing = await this.getByFromRid(rid);
    const incoming = await this.getByToRid(rid);
    
    return {
      outgoing,
      incoming
    };
  }

  async getByType(type) {
    const rows = await this.db.all(`
      SELECT * FROM relations WHERE type = ?
    `, [type]);
    
    return rows;
  }

  async getAll() {
    const rows = await this.db.all(`
      SELECT * FROM relations
    `);
    
    return rows;
  }

  async createBidirectional(ridA, ridB, type = 'reference') {
    await this.create(ridA, ridB, type);
    await this.create(ridB, ridA, type);
    
    return { ridA, ridB, type };
  }

  async removeBidirectional(ridA, ridB, type) {
    await this.remove(ridA, ridB, type);
    await this.remove(ridB, ridA, type);
    
    return { removed: true };
  }
}

module.exports = RelationService;