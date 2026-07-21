const fs = require('fs-extra');
const path = require('path');
const resetCommand = require('../../src/commands/reset.cjs');
const Repository = require('../../src/repo/repository.cjs');

describe('reset command', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-reset-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should reset staging area', async () => {
    const filePath = path.join(tempDir, 'test.md');
    await fs.writeFile(filePath, '# Test');

    const repo = new Repository(tempDir);
    await repo.init();
    await repo.staging.add(filePath);
    await repo.close();

    await resetCommand.run(tempDir);

    const repo2 = new Repository(tempDir);
    await repo2.open({ skipAuth: true });
    const status = await repo2.staging.getStatus();
    await repo2.close();

    expect(status.added).toEqual([]);
    expect(status.modified).toEqual([]);
    expect(status.deleted).toEqual([]);
  });

  test('should reset specific file', async () => {
    await fs.writeFile(path.join(tempDir, 'file1.md'), '# File 1');
    await fs.writeFile(path.join(tempDir, 'file2.md'), '# File 2');

    const repo = new Repository(tempDir);
    await repo.init();
    await repo.staging.add(path.join(tempDir, 'file1.md'));
    await repo.staging.add(path.join(tempDir, 'file2.md'));
    await repo.close();

    await resetCommand.run(tempDir, { files: ['file1.md'] });

    const repo2 = new Repository(tempDir);
    await repo2.open({ skipAuth: true });
    const status = await repo2.staging.getStatus();
    await repo2.close();

    expect(status.added.length).toBe(1);
    expect(status.added[0]).toBe('file2.md');
  });
});