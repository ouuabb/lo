const fs = require('fs-extra');
const path = require('path');
const categoryCommand = require('../../src/commands/category.cjs');
const Repository = require('../../src/repo/repository.cjs');

describe('category command', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-category-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should create category', async () => {
    const result = await categoryCommand.run(tempDir, { action: 'create', name: 'Test Category' });
    expect(result).not.toBeNull();
    expect(result.name).toBe('Test Category');
  });

  test('should list categories', async () => {
    await categoryCommand.run(tempDir, { action: 'create', name: 'Category 1' });
    await categoryCommand.run(tempDir, { action: 'create', name: 'Category 2' });

    const result = await categoryCommand.run(tempDir, { action: 'list' });
    expect(result.length).toBe(2);
  });

  test('should delete category', async () => {
    await categoryCommand.run(tempDir, { action: 'create', name: 'To Delete' });
    
    const before = await categoryCommand.run(tempDir, { action: 'list' });
    expect(before.length).toBe(1);

    await categoryCommand.run(tempDir, { action: 'delete', name: 'To Delete' });

    const after = await categoryCommand.run(tempDir, { action: 'list' });
    expect(after.length).toBe(0);
  });

  test('should show category tree', async () => {
    await categoryCommand.run(tempDir, { action: 'create', name: 'Root' });
    await categoryCommand.run(tempDir, { action: 'create', name: 'Root/Child' });

    const result = await categoryCommand.run(tempDir, { action: 'tree' });
    expect(result).not.toBeNull();
  });
});