const fs = require('fs-extra');
const path = require('path');
const Repository = require('../../src/repo/repository.cjs');
const Database = require('../../src/repo/database.cjs');

describe('Repository', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-repo-'));
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should initialize repository with init()', async () => {
    await fs.ensureDir(path.join(tempDir, '.repo'));
    const repo = new Repository(tempDir);
    await repo.init();

    expect(repo.db).not.toBeNull();
    expect(repo.resourceService).not.toBeNull();
    expect(repo.relationService).not.toBeNull();
    expect(repo.staging).not.toBeNull();
    expect(repo.staging._db).not.toBeNull();

    await repo.close();
  });

  test('should open repository with open()', async () => {
    await fs.ensureDir(path.join(tempDir, '.repo'));
    const repo = new Repository(tempDir);
    await repo.open({ skipAuth: true });

    expect(repo.db).not.toBeNull();
    expect(repo.resourceService).not.toBeNull();
    expect(repo.staging._db).not.toBeNull();

    await repo.close();
  });

  test('should have staging injected with db after open()', async () => {
    await fs.ensureDir(path.join(tempDir, '.repo'));
    const repo = new Repository(tempDir);
    await repo.open({ skipAuth: true });

    expect(repo.staging._db).toBe(repo.db);

    await repo.close();
  });

  test('should create resource', async () => {
    await fs.ensureDir(path.join(tempDir, '.repo'));
    const repo = new Repository(tempDir);
    await repo.open({ skipAuth: true });

    const resource = await repo.createResource('note', 'test content');
    expect(resource).not.toBeNull();
    expect(resource.type).toBe('note');
    expect(resource.rid).toMatch(/^res_/);

    await repo.close();
  });

  test('should get resource by RID', async () => {
    await fs.ensureDir(path.join(tempDir, '.repo'));
    const repo = new Repository(tempDir);
    await repo.open({ skipAuth: true });

    const created = await repo.createResource('note', 'test content');
    const retrieved = await repo.getResource(created.rid);

    expect(retrieved).not.toBeNull();
    expect(retrieved.rid).toBe(created.rid);

    await repo.close();
  });

  test('should list all resources', async () => {
    await fs.ensureDir(path.join(tempDir, '.repo'));
    const repo = new Repository(tempDir);
    await repo.open({ skipAuth: true });

    await repo.createResource('note', 'content 1');
    await repo.createResource('note', 'content 2');

    const resources = await repo.getAllResources();
    expect(resources.length).toBeGreaterThanOrEqual(2);

    await repo.close();
  });

  test('should update resource', async () => {
    await fs.ensureDir(path.join(tempDir, '.repo'));
    const repo = new Repository(tempDir);
    await repo.open({ skipAuth: true });

    const resource = await repo.createResource('note', 'original content');
    const updated = await repo.updateResource(resource.rid, { metadata: { title: 'Updated Title' } });

    expect(updated.metadata.title).toBe('Updated Title');

    await repo.close();
  });

  test('should delete resource', async () => {
    await fs.ensureDir(path.join(tempDir, '.repo'));
    const repo = new Repository(tempDir);
    await repo.open({ skipAuth: true });

    const resource = await repo.createResource('note', 'content');
    await repo.deleteResource(resource.rid);

    const deleted = await repo.getResource(resource.rid);
    expect(deleted).toBeNull();

    await repo.close();
  });

  test('should link resources', async () => {
    await fs.ensureDir(path.join(tempDir, '.repo'));
    const repo = new Repository(tempDir);
    await repo.open({ skipAuth: true });

    const resourceA = await repo.createResource('note', 'content A');
    const resourceB = await repo.createResource('note', 'content B');

    await repo.linkResources(resourceA.rid, resourceB.rid, 'reference');

    const relations = await repo.listRelations();
    expect(relations.length).toBeGreaterThanOrEqual(1);

    await repo.close();
  });

  test('should resolve resource by name', async () => {
    await fs.ensureDir(path.join(tempDir, '.repo'));
    const repo = new Repository(tempDir);
    await repo.open({ skipAuth: true });

    const resource = await repo.createResource('note', 'content', { filename: 'test-note.md' });
    const resolved = await repo.resolveResource(resource.name);

    expect(resolved).not.toBeNull();
    expect(resolved.name).toBe(resource.name);

    await repo.close();
  });
});