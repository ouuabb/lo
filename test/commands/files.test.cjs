const fs = require('fs-extra');
const path = require('path');
const filesCommand = require('../../src/commands/files.cjs');
const Repository = require('../../src/repo/repository.cjs');

describe('files command', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-files-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should list tracked files', async () => {
    const filePath = path.join(tempDir, 'test.md');
    await fs.writeFile(filePath, '# Test');

    const repo = new Repository(tempDir);
    await repo.init();
    await repo.staging.add(filePath);
    await repo.close();

    const result = await filesCommand.run(tempDir);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('test.md');
  });

  test('should show file details', async () => {
    const filePath = path.join(tempDir, 'test.md');
    await fs.writeFile(filePath, '# Test\n\nContent');

    const repo = new Repository(tempDir);
    await repo.init();
    await repo.staging.add(filePath);
    await repo.close();

    const result = await filesCommand.run(tempDir, { details: true });
    expect(result.length).toBe(1);
    expect(result[0].size).toBeGreaterThan(0);
    expect(result[0].mtime).toBeDefined();
  });

  test('should handle empty repo', async () => {
    const repo = new Repository(tempDir);
    await repo.init();
    await repo.close();

    const result = await filesCommand.run(tempDir);
    expect(result).toEqual([]);
  });
});