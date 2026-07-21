const fs = require('fs-extra');
const path = require('path');
const statusCommand = require('../../src/commands/status.cjs');
const Repository = require('../../src/repo/repository.cjs');

describe('status command', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-status-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should return empty status for clean repo', async () => {
    const repo = new Repository(tempDir);
    await repo.init();
    await repo.close();

    const result = await statusCommand.run(tempDir);
    expect(result.added).toEqual([]);
    expect(result.modified).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(result.renamed).toEqual([]);
    expect(result.metadata).toEqual([]);
  });

  test('should show staged changes', async () => {
    const repo = new Repository(tempDir);
    await repo.init();

    await fs.writeFile(path.join(tempDir, 'new.md'), '# New');
    await repo.staging.add(path.join(tempDir, 'new.md'));

    await repo.close();

    const result = await statusCommand.run(tempDir);
    expect(result.added.length).toBe(1);
  });

  test('should show modified files', async () => {
    const repo = new Repository(tempDir);
    await repo.init();

    await fs.writeFile(path.join(tempDir, 'existing.md'), '# Original');
    await repo.staging.add(path.join(tempDir, 'existing.md'));
    
    await fs.writeFile(path.join(tempDir, 'existing.md'), '# Modified');

    await repo.close();

    const result = await statusCommand.run(tempDir);
    expect(result.modified.length).toBe(1);
  });

  test('should show deleted files', async () => {
    const repo = new Repository(tempDir);
    await repo.init();

    await fs.writeFile(path.join(tempDir, 'to-delete.md'), '# Delete');
    await repo.staging.add(path.join(tempDir, 'to-delete.md'));
    await repo.staging.remove(path.join(tempDir, 'to-delete.md'));

    await repo.close();

    const result = await statusCommand.run(tempDir);
    expect(result.deleted.length).toBe(1);
  });
});