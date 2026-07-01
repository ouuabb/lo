const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

class Database {
  constructor(repoPath) {
    this.repoPath = repoPath;
    this.dbPath = path.join(repoPath, '.repo', 'database.sqlite');
    this.db = null;
  }

  async open() {
    await fs.ensureDir(path.join(this.repoPath, '.repo'));
    
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  async init() {
    await this.open();
    await this.createTables();
    return this;
  }

  async createTables() {
    await this.run(`
      CREATE TABLE IF NOT EXISTS resources (
        rid TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        hash TEXT,
        metadata TEXT DEFAULT '{}',
        created INTEGER NOT NULL,
        updated INTEGER NOT NULL,
        deleted INTEGER DEFAULT 0
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_rid TEXT NOT NULL,
        to_rid TEXT NOT NULL,
        type TEXT NOT NULL,
        created INTEGER NOT NULL,
        UNIQUE(from_rid, to_rid, type)
      )
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type)
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_resources_path ON resources(path)
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_rid)
    `);

    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_rid)
    `);
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;