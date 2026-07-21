const fs = require('fs-extra');
const path = require('path');
const diffCommand = require('../../src/commands/diff.cjs');
const Repository = require('../../src/repo/repository.cjs');

describe('diff command', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-diff-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should show diff for modified file', async () => {
    const filePath = path.join(tempDir, 'test.md');
    await fs.writeFile(filePath, '# Original\n\nContent');

    const repo = new Repository(tempDir);
    await repo.init();
    await repo.staging.add(filePath);
    
    await fs.writeFile(filePath, '# Modified\n\nNew Content');
    
    await repo.close();

    const result = await diffCommand.run(tempDir, { files: ['test.md'] });
    expect(result).not.toBeNull();
    expect(result.modified.length).toBe(1);
  });

  test('should show diff for all files', async () => {
    await fs.writeFile(path.join(tempDir, 'file1.md'), '# Original 1');
    await fs.writeFile(path.join(tempDir, 'file2.md'), '# Original 2');

    const repo = new Repository(tempDir);
    await repo.init();
    await repo.staging.add(path.join(tempDir, 'file1.md'));
    await repo.staging.add(path.join(tempDir, 'file2.md'));
    
    await fs.writeFile(path.join(tempDir, 'file1.md'), '# Modified 1');
    await fs.writeFile(path.join(tempDir, 'file2.md'), '# Modified 2');
    
    await repo.close();

    const result = await diffCommand.run(tempDir);
    expect(result.modified.length).toBe(2);
  });

  test('should handle clean repo', async () => {
    const repo = new Repository(tempDir);
    await repo.init();
    await repo.close();

    const result = await diffCommand.run(tempDir);
    expect(result.modified).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.deleted).toEqual([]);
  });
});