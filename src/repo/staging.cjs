const fs = require('fs-extra');
const path = require('path');

class StagingArea {
  constructor(repoPath) {
    this.repoPath = repoPath;
    this.stagingPath = path.join(repoPath, '.repo', 'staging.json');
    this.resourcesPath = path.join(repoPath, 'resources');
  }

  async _load() {
    try {
      const content = await fs.readFile(this.stagingPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {
        added: [],
        modified: [],
        deleted: [],
        renamed: []
      };
    }
  }

  async _save(staging) {
    await fs.ensureDir(path.dirname(this.stagingPath));
    await fs.writeFile(this.stagingPath, JSON.stringify(staging, null, 2));
  }

  async _clear() {
    await this._save({
      added: [],
      modified: [],
      deleted: [],
      renamed: []
    });
  }

  async add(filePath) {
    const staging = await this._load();
    const relPath = this._relative(filePath);
    
    if (!staging.added.includes(relPath)) {
      staging.added.push(relPath);
    }
    
    const idx = staging.deleted.indexOf(relPath);
    if (idx > -1) {
      staging.deleted.splice(idx, 1);
    }
    
    await this._save(staging);
    return relPath;
  }

  async addAll() {
    const staging = await this._load();
    const existingPaths = new Set(staging.added);
    
    const files = await fs.readdir(this.resourcesPath, { recursive: true });
    for (const file of files) {
      const absPath = path.join(this.resourcesPath, file);
      const stats = await fs.stat(absPath);
      if (stats.isFile()) {
        const relPath = this._relative(absPath);
        if (!existingPaths.has(relPath)) {
          staging.added.push(relPath);
          existingPaths.add(relPath);
        }
      }
    }
    
    await this._save(staging);
    return staging.added.length;
  }

  async remove(filePath) {
    const staging = await this._load();
    const relPath = this._relative(filePath);
    
    const idx = staging.added.indexOf(relPath);
    if (idx > -1) {
      staging.added.splice(idx, 1);
    }
    
    if (!staging.deleted.includes(relPath)) {
      staging.deleted.push(relPath);
    }
    
    await this._save(staging);
    return relPath;
  }

  async reset(filePath = null) {
    const staging = await this._load();
    
    if (filePath) {
      const relPath = this._relative(filePath);
      const idx = staging.added.indexOf(relPath);
      if (idx > -1) staging.added.splice(idx, 1);
      
      const delIdx = staging.deleted.indexOf(relPath);
      if (delIdx > -1) staging.deleted.splice(delIdx, 1);
    } else {
      await this._clear();
      return null;
    }
    
    await this._save(staging);
    return this._relative(filePath);
  }

  async getStatus() {
    return await this._load();
  }

  async hasChanges() {
    const staging = await this._load();
    return staging.added.length > 0 || 
           staging.modified.length > 0 || 
           staging.deleted.length > 0 || 
           staging.renamed.length > 0;
  }

  async commit(repository) {
    const staging = await this._load();
    const results = { added: 0, updated: 0, deleted: 0, renamed: 0 };

    for (const relPath of staging.added) {
      const absPath = path.join(this.resourcesPath, relPath);
      if (await fs.pathExists(absPath)) {
        await repository.resourceService.importFile(absPath);
        results.added++;
      }
    }

    for (const relPath of staging.deleted) {
      const absPath = path.join(this.resourcesPath, relPath);
      const existing = await repository.resourceService.getByPath(absPath);
      if (existing) {
        await repository.resourceService.delete(existing.rid, true);
        results.deleted++;
      }
    }

    for (const rename of staging.renamed) {
      const oldPath = path.join(this.resourcesPath, rename.old);
      const newPath = path.join(this.resourcesPath, rename.new);
      const existing = await repository.resourceService.getByPath(oldPath);
      if (existing) {
        await repository.resourceService.update(existing.rid, { path: newPath });
        results.renamed++;
      }
    }

    await this._clear();
    return results;
  }

  _relative(filePath) {
    if (path.isAbsolute(filePath)) {
      return path.relative(this.resourcesPath, filePath);
    }
    return filePath;
  }
}

module.exports = StagingArea;