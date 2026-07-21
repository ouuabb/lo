const fs = require('fs-extra');
const path = require('path');
const rmCommand = require('../../src/commands/rm.cjs');
const Repository = require('../../src/repo/repository.cjs');

describe('rm command', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-rm-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should remove file from staging', async () => {
    const filePath = path.join(tempDir, 'test.md');
    await fs.writeFile(filePath, '# Test');

    const repo = new Repository(tempDir);
    await repo.init();
    await repo.staging.add(filePath);
    await repo.close();

    const result = await rmCommand.run(tempDir, { files: ['test.md'] });
    expect(result.deleted.length).toBe(1);
  });

  test('should remove multiple files', async () => {
    await fs.writeFile(path.join(tempDir, 'file1.md'), '# File 1');
    await fs.writeFile(path.join(tempDir, 'file2.md'), '# File 2');

    const repo = new Repository(tempDir);
    await repo.init();
    await repo.staging.add(path.join(tempDir, 'file1.md'));
    await repo.staging.add(path.join(tempDir, 'file2.md'));
    await repo.close();

    const result = await rmCommand.run(tempDir, { files: ['file1.md', 'file2.md'] });
    expect(result.deleted.length).toBe(2);
  });

  test('should handle non-existent file', async () => {
    await expect(rmCommand.run(tempDir, { files: ['nonexistent.md'] })).rejects.toThrow();
  });
});