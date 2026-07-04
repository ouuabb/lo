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
        renamed: [],
        metadata: []
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
      renamed: [],
      metadata: []
    });
  }

  async add(filePath, repository) {
    const staging = await this._load();
    const relPath = this._relative(filePath);

    // 检查文件是否已入库（modified）还是新文件（added）
    let isModified = false;
    if (repository) {
      const existing = await repository.resourceService.getByPath(filePath);
      if (existing) {
        isModified = true;
      }
    }

    if (isModified) {
      if (!staging.modified.includes(relPath)) {
        staging.modified.push(relPath);
      }
      // 同时从 added 中移除（如果之前被错误地标记为 added）
      const addIdx = staging.added.indexOf(relPath);
      if (addIdx > -1) staging.added.splice(addIdx, 1);
    } else {
      if (!staging.added.includes(relPath)) {
        staging.added.push(relPath);
      }
    }

    const idx = staging.deleted.indexOf(relPath);
    if (idx > -1) {
      staging.deleted.splice(idx, 1);
    }

    await this._save(staging);
    return relPath;
  }

  async addAll(repository) {
    const staging = await this._load();
    const existingPaths = new Set([...staging.added, ...staging.modified]);

    const files = await fs.readdir(this.resourcesPath, { recursive: true });
    for (const file of files) {
      const absPath = path.join(this.resourcesPath, file);
      const stats = await fs.stat(absPath);
      if (stats.isFile()) {
        const relPath = this._relative(absPath);
        if (!existingPaths.has(relPath)) {
          // 逐个调用 add 以正确分类 added/modified
          await this.add(absPath, repository);
          existingPaths.add(relPath);
        }
      }
    }

    const updated = await this._load();
    return updated.added.length + updated.modified.length;
  }

  async remove(filePath) {
    const staging = await this._load();
    const relPath = this._relative(filePath);

    const addIdx = staging.added.indexOf(relPath);
    if (addIdx > -1) staging.added.splice(addIdx, 1);

    const modIdx = staging.modified.indexOf(relPath);
    if (modIdx > -1) staging.modified.splice(modIdx, 1);

    if (!staging.deleted.includes(relPath)) {
      staging.deleted.push(relPath);
    }

    await this._save(staging);
    return relPath;
  }

  async rename(oldPath, newPath) {
    const staging = await this._load();
    const oldRel = this._relative(oldPath);
    const newRel = this._relative(newPath);

    // 从其他数组中移除
    ['added', 'modified', 'deleted'].forEach(key => {
      const idx = staging[key].indexOf(oldRel);
      if (idx > -1) staging[key].splice(idx, 1);
    });

    // 添加重命名记录
    const existing = staging.renamed.find(r => r.old === oldRel);
    if (existing) {
      existing.new = newRel;
    } else {
      staging.renamed.push({ old: oldRel, new: newRel });
    }

    await this._save(staging);
    return { old: oldRel, new: newRel };
  }

  async reset(filePath = null) {
    const staging = await this._load();

    if (filePath) {
      const relPath = this._relative(filePath);
      const addIdx = staging.added.indexOf(relPath);
      if (addIdx > -1) staging.added.splice(addIdx, 1);
      const modIdx = staging.modified.indexOf(relPath);
      if (modIdx > -1) staging.modified.splice(modIdx, 1);
      const delIdx = staging.deleted.indexOf(relPath);
      if (delIdx > -1) staging.deleted.splice(delIdx, 1);
      // 也重置该路径对应资源的元数据暂存
      if (staging.metadata) {
        staging.metadata = staging.metadata.filter(m => m.rid !== filePath && m.path !== relPath);
      }
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

  // 暂存元数据变更（rid + 变更内容）
  async stageMetadata(rid, changes) {
    const staging = await this._load();
    if (!staging.metadata) staging.metadata = [];

    const existing = staging.metadata.find(m => m.rid === rid);
    if (existing) {
      Object.assign(existing, changes);
    } else {
      staging.metadata.push({ rid, ...changes });
    }

    await this._save(staging);
  }

  // 取消指定资源的元数据暂存
  async resetMetadata(rid) {
    const staging = await this._load();
    if (staging.metadata) {
      staging.metadata = staging.metadata.filter(m => m.rid !== rid);
    }
    await this._save(staging);
  }

  async hasChanges() {
    const staging = await this._load();
    return staging.added.length > 0 ||
           staging.modified.length > 0 ||
           staging.deleted.length > 0 ||
           staging.renamed.length > 0 ||
           (staging.metadata && staging.metadata.length > 0);
  }

  async commit(repository) {
    const staging = await this._load();
    const results = { added: 0, updated: 0, deleted: 0, renamed: 0, metadata: 0 };

    for (const relPath of staging.added) {
      const absPath = path.join(this.resourcesPath, relPath);
      if (await fs.pathExists(absPath)) {
        await repository.resourceService.importFile(absPath);
        results.added++;
      }
    }

    for (const relPath of staging.modified) {
      const absPath = path.join(this.resourcesPath, relPath);
      if (await fs.pathExists(absPath)) {
        const existing = await repository.resourceService.getByPath(absPath);
        if (existing) {
          await repository.resourceService.refresh(existing.rid);
          results.updated++;
        } else {
          // 文件不在库中，降级为 import
          await repository.resourceService.importFile(absPath);
          results.added++;
        }
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

    // 处理元数据变更
    if (staging.metadata && staging.metadata.length > 0) {
      for (const meta of staging.metadata) {
        const resource = await repository.resourceService.getByRid(meta.rid);
        if (resource) {
          const merged = { ...resource.metadata, ...meta };
          delete merged.rid; // rid 不应存在于 metadata 中
          await repository.resourceService.update(meta.rid, { metadata: merged });
          results.metadata++;
        }
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
