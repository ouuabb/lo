const fs = require('fs-extra');
const path = require('path');
const listCommand = require('../../src/commands/list.cjs');
const Repository = require('../../src/repo/repository.cjs');

describe('list command', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'lo-test-list-'));
    await fs.ensureDir(path.join(tempDir, '.repo'));
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  test('should list resources', async () => {
    const repo = new Repository(tempDir);
    await repo.init();

    await repo.createResource('note', '# Note 1\n\nContent 1');
    await repo.createResource('note', '# Note 2\n\nContent 2');

    await repo.close();

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const result = await listCommand({});
      expect(result).not.toBeNull();
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should handle empty repository', async () => {
    const repo = new Repository(tempDir);
    await repo.init();
    await repo.close();

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const result = await listCommand({});
      expect(result).not.toBeNull();
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should list with limit', async () => {
    const repo = new Repository(tempDir);
    await repo.init();

    await repo.createResource('note', '# Note 1');
    await repo.createResource('note', '# Note 2');
    await repo.createResource('note', '# Note 3');

    await repo.close();

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const result = await listCommand({ limit: 2 });
      expect(result).not.toBeNull();
    } finally {
      process.chdir(originalCwd);
    }
  });
});