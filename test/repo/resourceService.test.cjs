const fs = require('fs-extra');
const path = require('path');
const ResourceService = require('../../src/repo/resourceService.cjs');
const Database = require('../../src/repo/database.cjs');

describe('ResourceService', () => {
  let tempDir;
  let db;
  let resourceService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-resource-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
    db = new Database(tempDir);
    await db.init();
    resourceService = new ResourceService(db);
  });

  afterEach(async () => {
    if (db) await db.close();
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should create resource', async () => {
    const filePath = path.join(tempDir, 'resources', 'test.md');
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, '# Test');

    const resource = await resourceService.create({
      type: 'note',
      path: filePath,
      name: 'test'
    });

    expect(resource).not.toBeNull();
    expect(resource.type).toBe('note');
    expect(resource.path).toBe(filePath);
    expect(resource.rid).toMatch(/^res_/);
  });

  test('should get resource by RID', async () => {
    const filePath = path.join(tempDir, 'resources', 'test.md');
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, '# Test');

    const created = await resourceService.create({
      type: 'note',
      path: filePath,
      name: 'test'
    });

    const retrieved = await resourceService.getByRid(created.rid);
    expect(retrieved).not.toBeNull();
    expect(retrieved.rid).toBe(created.rid);
  });

  test('should get resource by name', async () => {
    const filePath = path.join(tempDir, 'resources', 'test.md');
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, '# Test');

    await resourceService.create({
      type: 'note',
      path: filePath,
      name: 'unique-name'
    });

    const retrieved = await resourceService.getByName('unique-name');
    expect(retrieved).not.toBeNull();
    expect(retrieved.name).toBe('unique-name');
  });

  test('should get resource by path', async () => {
    const filePath = path.join(tempDir, 'resources', 'test.md');
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, '# Test');

    await resourceService.create({
      type: 'note',
      path: filePath,
      name: 'test'
    });

    const retrieved = await resourceService.getByPath(filePath);
    expect(retrieved).not.toBeNull();
    expect(retrieved.path).toBe(filePath);
  });

  test('should get all resources', async () => {
    const filePath1 = path.join(tempDir, 'resources', 'test1.md');
    const filePath2 = path.join(tempDir, 'resources', 'test2.md');
    await fs.ensureDir(path.dirname(filePath1));
    await fs.writeFile(filePath1, '# Test 1');
    await fs.writeFile(filePath2, '# Test 2');

    await resourceService.create({ type: 'note', path: filePath1, name: 'test1' });
    await resourceService.create({ type: 'note', path: filePath2, name: 'test2' });

    const resources = await resourceService.getAll();
    expect(resources.length).toBeGreaterThanOrEqual(2);
  });

  test('should update resource', async () => {
    const filePath = path.join(tempDir, 'resources', 'test.md');
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, '# Test');

    const created = await resourceService.create({
      type: 'note',
      path: filePath,
      name: 'test',
      metadata: { title: 'Original' }
    });

    const updated = await resourceService.update(created.rid, {
      metadata: { title: 'Updated', tags: ['tag1'] }
    });

    expect(updated.metadata.title).toBe('Updated');
    expect(updated.metadata.tags).toEqual(['tag1']);
  });

  test('should delete resource', async () => {
    const filePath = path.join(tempDir, 'resources', 'test.md');
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, '# Test');

    const created = await resourceService.create({
      type: 'note',
      path: filePath,
      name: 'test'
    });

    await resourceService.delete(created.rid);

    const deleted = await resourceService.getByRid(created.rid);
    expect(deleted).toBeNull();
  });

  test('should import file', async () => {
    const filePath = path.join(tempDir, 'imported.md');
    await fs.writeFile(filePath, '# Imported');

    const resource = await resourceService.importFile(filePath);
    expect(resource).not.toBeNull();
    expect(resource.type).toBe('note');
    expect(resource.path).toBe(filePath);
  });

  test('should generate unique RID', async () => {
    const rid1 = await resourceService._generateRid();
    const rid2 = await resourceService._generateRid();

    expect(rid1).toMatch(/^res_/);
    expect(rid2).toMatch(/^res_/);
    expect(rid1).not.toBe(rid2);
  });
});