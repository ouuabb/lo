const Database = require('./database.cjs');
const ResourceService = require('./resourceService.cjs');
const RelationService = require('./relationService.cjs');
const QueryEngine = require('./queryEngine.cjs');
const FileWatcher = require('./fileWatcher.cjs');
const glob = require('glob');
const fs = require('fs-extra');
const path = require('path');
const ResourceType = require('../utils/resourceType.cjs');

class Repository {
  constructor(repoPath = process.cwd()) {
    this.repoPath = repoPath;
    this.db = null;
    this.resourceService = null;
    this.relationService = null;
    this.queryEngine = null;
    this.watcher = null;
  }

  async init() {
    this.db = new Database(this.repoPath);
    await this.db.init();
    
    this.resourceService = new ResourceService(this.db);
    this.relationService = new RelationService(this.db);
    this.queryEngine = new QueryEngine(this.db);
    
    return this;
  }

  async open() {
    this.db = new Database(this.repoPath);
    await this.db.open();
    
    this.resourceService = new ResourceService(this.db);
    this.relationService = new RelationService(this.db);
    this.queryEngine = new QueryEngine(this.db);
    
    return this;
  }

  async close() {
    if (this.watcher) {
      this.watcher.stop();
    }
    if (this.db) {
      await this.db.close();
    }
  }

  async importFile(filePath, type = null) {
    return this.resourceService.importFile(filePath, type);
  }

  async importDirectory(dirPath, type = null) {
    const patterns = ResourceType.getExtensions(type || 'note').map(ext => `${dirPath}/**/*${ext}`);
    
    const files = glob.sync(`{${patterns.join(',')}}`, {
      cwd: this.repoPath,
      ignore: ['**/node_modules/**', '**/.git/**', '**/.repo/**'],
      absolute: true
    });

    const results = [];
    for (const file of files) {
      try {
        const resource = await this.resourceService.importFile(file, type);
        results.push(resource);
      } catch (e) {
        console.warn(`Failed to import ${file}: ${e.message}`);
      }
    }
    
    return results;
  }

  async createResource(type, content, options = {}) {
    const { filename, metadata = {} } = options;
    
    const ext = ResourceType.getExtensions(type)[0] || '.md';
    const name = filename || `${Date.now()}${ext}`;
    const filePath = path.join(this.repoPath, 'resources', name);
    
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content);
    
    return this.resourceService.create({
      type,
      path: filePath,
      metadata
    });
  }

  async getResource(rid) {
    return this.resourceService.getByRid(rid);
  }

  async getResourceByPath(filePath) {
    return this.resourceService.getByPath(filePath);
  }

  async getAllResources(options = {}) {
    return this.resourceService.getAll(options);
  }

  async updateResource(rid, updates) {
    return this.resourceService.update(rid, updates);
  }

  async deleteResource(rid, soft = true) {
    return this.resourceService.delete(rid, soft);
  }

  async moveResource(rid, newPath) {
    return this.resourceService.move(rid, newPath);
  }

  async linkResources(ridA, ridB, type = 'reference') {
    return this.relationService.createBidirectional(ridA, ridB, type);
  }

  async unlinkResources(ridA, ridB, type) {
    return this.relationService.removeBidirectional(ridA, ridB, type);
  }

  async getRelations(rid) {
    return this.relationService.getRelations(rid);
  }

  async query(options = {}) {
    return this.queryEngine.queryResources(options);
  }

  async search(query) {
    return this.queryEngine.search(query);
  }

  async getStats() {
    return this.queryEngine.getStats();
  }

  async getGraph(rid) {
    return this.queryEngine.getGraph(rid);
  }

  async sync() {
    const resources = await this.resourceService.getAll();
    
    for (const resource of resources) {
      try {
        if (!await fs.pathExists(resource.path)) {
          await this.resourceService.delete(resource.rid, true);
        } else {
          await this.resourceService.rehash(resource.rid);
        }
      } catch (e) {
        console.warn(`Failed to sync ${resource.path}: ${e.message}`);
      }
    }
    
    return resources.length;
  }

  startWatcher(callback) {
    this.watcher = new FileWatcher(this.repoPath, async (event) => {
      try {
        await this._handleFileEvent(event);
        if (callback) {
          callback(event);
        }
      } catch (e) {
        console.error(`Watcher event error: ${e.message}`);
      }
    });
    
    this.watcher.start();
    return this;
  }

  async _handleFileEvent(event) {
    const { event: eventType, path: filePath } = event;
    
    switch (eventType) {
      case 'add':
        if (ResourceType.isSupported(filePath)) {
          await this.resourceService.importFile(filePath);
        }
        break;
        
      case 'change':
        const resource = await this.resourceService.getByPath(filePath);
        if (resource) {
          await this.resourceService.rehash(resource.rid);
        }
        break;
        
      case 'delete':
        const deletedResource = await this.resourceService.getByPath(filePath);
        if (deletedResource) {
          await this.resourceService.delete(deletedResource.rid, true);
        }
        break;
    }
  }

  static async create(repoPath) {
    await fs.ensureDir(repoPath);
    await fs.ensureDir(path.join(repoPath, 'resources'));
    
    const repo = new Repository(repoPath);
    await repo.init();
    
    return repo;
  }
}

module.exports = Repository;